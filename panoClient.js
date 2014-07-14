(function(global){


  function panoClient(){

    // cервер
    this.server = 'http://127.0.0.1:8080/';
    
    // сокет
    this.socket = null;

    // ширина вьюпорта
    this.width = $(window).width();

    // основной контейнер видео
    this.video = document.getElementById('video-pano');

    this.panoramaWidth = 8182;
    this.screenWidth = 4096;
    this.screenHeight = 600;

    this.delta_1 = this.screenWidth*1;
    this.delta_2 = this.screenWidth*2;
    this.delta_3 = this.screenWidth*3;
    this.delta_4 = this.screenWidth*4;

    // принимать ли позишен
    this.posFlag = true;
    
    // части панорамы
    this.video_p0 = document.getElementById('video-part-0');
    this.video_p1 = document.getElementById('video-part-1');
    this.video_p2 = document.getElementById('video-part-2');
    this.video_p3 = document.getElementById('video-part-3');

    // массив с частями панорамы
    this.videos = [
      this.video_p0,
      this.video_p1,
      this.video_p2,
      this.video_p3
    ];

    // когда ролик панорамы заканчивает играть начинаем играть видео всплытия
    var index = this.videos.length;
    while(index--){
      $(this.videos[index]).on('ended',$.proxy(this.ended, this));
    }

    // отличие от состояние ролика с плановым в секундах, при котором происходит синхронизация
    this.seekDelta = 0.25;
    
    // синхронизация не чаще чем раз в N секунд
    this.sync_pause = 2;

    // изменилось ли смещение панорамы
    this.changed = false;

    // смещение панорамы
    this.position = 0;

    // смещение экрана в панораме
    this.offset = 0;

    // время начала отображения ролика
    this.start_time = new Date().getTime()/1000;

    // cоединяемся с сервером
    this.connectToServer();

    // cообщаем серверу о изменении размеров экрана для перестроения панорамы
    $(window).resize($.proxy(this.resize,this));

    // сообщаем серверу о смещении панорамы
    $(window).on('mousewheel', $.proxy(this.mousePosition,this));
    $(window).on('keyup', $.proxy(this.keyControls,this));

    // перерисовываем панораму
    this.animationLoop();
  }

  panoClient.prototype.connectToServer = function(){
    this.socket = io.connect(this.server, { query: "index="+this.video.getAttribute('data-screen') });
    this.socket.on("position", $.proxy(this.positionChange,this));
    this.socket.on("canvasDetails", $.proxy(this.canvasDetails,this));
    this.socket.on("reconnect", $.proxy(this.resize,this));
    this.socket.on("startTime", $.proxy(this.timeSync,this));
    this.socket.on("sync", $.proxy(this.timeSync,this));
    this.socket.on("emersion", $.proxy(this.emersion,this));
    this.socket.on("immersion", $.proxy(this.immersion,this));
    this.socket.on("emersionStart", $.proxy(this.emersionStart,this));
    this.socket.on("surfaceStart", $.proxy(this.emersionStart,this));
    this.resize();
  };

  // Сигнал к всплытию
  panoClient.prototype.emersion = function(event) {
    var index = this.videos.length;
    while(index--){
      this.videos[index].loop = false;
      this.videos[index].autoplay = false;
    }
  };  

  // Окончание проигрывания роликов
  panoClient.prototype.ended = function(event) {
    // console.log('закончили играть ролик панорамы и начинаем играть ролик всплытия');

    var index = this.videos.length;
    while(index--){
      this.videos[index].src = this.videos[index].getAttribute('data-immersion');
      this.videos[index].pause();
      this.videos[index].load();
      // сообщаем что ролик на этом экране может начать проигрываться
      $(this.videos[index]).on('canplaythrough', $.proxy(this.emersionReady,this));
    }

    // части панорамы
    this.video_p0 = document.getElementById('video-part-0');
    this.video_p1 = document.getElementById('video-part-1');
    this.video_p2 = document.getElementById('video-part-2');
    this.video_p3 = document.getElementById('video-part-3');

    // массив с частями панорамы
    this.videos = [
      this.video_p0,
      this.video_p1,
      this.video_p2,
      this.video_p3
    ];

    // когда заканчивается ролик всплытия начинаем играть ролик поверхности
    var index = this.videos.length;
    while(index--){
      $(this.videos[index]).on('ended',$.proxy(this.emersionEnded, this));
    }

  };

  // cообщаем о том, что этот ролик готов к проигрыванию анимации всплытия
  panoClient.prototype.emersionReady = function(event) {
    var index = this.videos.length;
    while(index--){
      if(this.videos[index].readyState!= 4){
        return;
      }
    }
    this.socket.emit('readyToEmersion');
  };

  panoClient.prototype.emersionStart = function(time) {
    this.start_time = time;
    var index = this.videos.length;
    while(index--){
      this.videos[index].play();
    }
    this.changed = true;
  };

  // Окончание проигрывания роликов
  panoClient.prototype.emersionEnded = function(event) {
    // console.log('закончили играть ролик панорамы и начинаем играть ролик всплытия');

    var index = this.videos.length;
    while(index--){
      this.videos[index].src = this.videos[index].getAttribute('data-surface');
      this.videos[index].pause();
      this.videos[index].load();
      $(this.videos[index]).on('canplaythrough', $.proxy(this.surfaceReady,this));
    }

    // части панорамы
    this.video_p0 = document.getElementById('video-part-0');
    this.video_p1 = document.getElementById('video-part-1');
    this.video_p2 = document.getElementById('video-part-2');
    this.video_p3 = document.getElementById('video-part-3');

    // массив с частями панорамы
    this.videos = [
      this.video_p0,
      this.video_p1,
      this.video_p2,
      this.video_p3
    ];

    // отменяем событие по окончанию проигрывания ролика
    var index = this.videos.length;
    while(index--){
      this.videos[index].loop = true;
      this.videos[index].autoplay = true;
      $(this.videos[index]).off('ended');
    }


  };

  // cообщаем о том, что этот ролик готов к проигрыванию анимации поверхности
  panoClient.prototype.surfaceReady = function(event) {
    var index = this.videos.length;
    while(index--){
      if(this.videos[index].readyState!= 4){
        return;
      }
    }
    this.socket.emit('surfaceReady');
  };

  panoClient.prototype.surfaceStart = function(time) {
    this.start_time = time;
    var index = this.videos.length;
    while(index--){
      this.videos[index].play();
    }
    this.emmersion = true;
    this.changed = true;
  };

  panoClient.prototype.immersion = function(event) {
    location.reload();
  };


  panoClient.prototype.keyControls = function(event) {
    console.log(event.keyCode)
    switch(event.keyCode){
      // F — всплытие
      case 70:
        this.socket.emit('emersion');
        break;
      // G cначала
      case 71:
        this.socket.emit('immersion');
        break;
    }
  };


  panoClient.prototype.animationLoop = function() {
    if(this.changed){

      var pos = this.position-this.offset;
      pos = pos % this.delta_4;

      if(pos>-this.delta_1){
        pos-=this.panoramaWidth;
      }

      if(pos<-this.delta_3){
        pos+=this.panoramaWidth;
      }

      if(this.forward&&(pos<-this.delta_2)){
        pos+=this.panoramaWidth;
      }

      this.changed = false;
      this.video.style.left = pos+"px";
    }

    return requestAnimationFrame($.proxy(this.animationLoop,this));
  };

  panoClient.prototype.resize = function(){
    if(this.socket==null){
      return;
    }
    this.width = $(window).width();
    this.socket.emit('dimensions', {
      'width':this.width
    });
  };

  panoClient.prototype.timeSync = function(startTime){
    this.start_time = startTime;
    var index = this.videos.length;

    while(index--){
      this.syncAbsoluteAndPlay(this.videos[index]);
    }

    this.changed = true;
  };

  panoClient.prototype.syncAbsoluteAndPlay = function(video){

    // синхронизация с расчетным временем
    var current_time = new Date().getTime()/1000,
        sync_time = parseFloat(video.getAttribute('data-sync'),10),
        time_passed = current_time - this.start_time,
        current_movie_time = time_passed % this.video_p1.duration;

    if(video.seeking){
      return;
    }

    if(Math.abs(video.currentTime-current_movie_time)>this.seekDelta){
      if(typeof video.fastSeek != "undefined"){
        // console.log('быстро');
        video.fastSeek(current_movie_time);
      }else{
        // console.log('медленно');
        video.currentTime = current_movie_time;
      }
      video.setAttribute('data-sync', current_time);
    }
  }

  panoClient.prototype.canvasDetails = function(data){
    this.offset = data.offset;
    this.number = data.number;
    this.changed = true;
  };


  panoClient.prototype.positionChange = function(data){
    this.position = data;
    this.changed = true;
  };

  panoClient.prototype.mousePosition = function(event){
    this.socket.emit('position',event.deltaY);
  };

  $(window).load(onDOMReady);

  function onDOMReady(){
    global.panoClient = new panoClient;
  }

})(this);
