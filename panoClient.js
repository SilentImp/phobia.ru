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

    // принимать ли позишен
    this.posFlag = true;

    this.emmersion=false;
    
    // части панорамы
    this.video_p1 = document.getElementById('video-part-1');
    this.video_p2 = document.getElementById('video-part-2');
    this.video_p3 = document.getElementById('video-part-3');
    this.video_p4 = document.getElementById('video-part-4');

    // массив с частями панорамы
    this.videos = [
      this.video_p1,
      this.video_p2,
      this.video_p3,
      this.video_p4
    ];

    var index = this.videos.length;
    while(index--){
      $(this.videos[index]).on('ended',$.proxy(this.ended, this));
    }

    // расстояние до «края» в px при котором начинам готовится к скачку на другой край
    this.delta = 500;

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

    $(window).on('keyup', $.proxy(this.goUpAndDown,this));

    // перерисовываем панораму
    this.animationLoop();
  }

  panoClient.prototype.emersion = function(event) {
    var index = this.videos.length;
    while(index--){
      this.videos[index].loop = false;
      this.videos[index].autoplay = false;
    }

  };

  panoClient.prototype.ended = function(event) {
    console.log('закончили играть ролик');
    var index = this.videos.length;
    while(index--){
      this.videos[index].src = this.videos[index].getAttribute('data-immersion');
      this.videos[index].pause();
      this.videos[index].load();
      $(this.videos[index]).on('canplaythrough', $.proxy(this.emersionStart,this));
    }

    // части панорамы
    this.video_p1 = document.getElementById('video-part-1');
    this.video_p2 = document.getElementById('video-part-2');
    this.video_p3 = document.getElementById('video-part-3');
    this.video_p4 = document.getElementById('video-part-4');

    // массив с частями панорамы
    this.videos = [
      this.video_p1,
      this.video_p2,
      this.video_p3,
      this.video_p4
    ];
  };

  panoClient.prototype.emersionStart = function(event) {
    var index = this.videos.length;
    while(index--){
      if(this.videos[index].readyState!= 4){
        return;
      }
    }
    console.log('readyToPlay');
    this.socket.emit('readyToPlay');
  };

  panoClient.prototype.gogogo = function(time) {
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

  panoClient.prototype.goUpAndDown = function(event) {
    // console.log(event)
    switch(event.keyCode){
      case 70:
        this.socket.emit('emersion');
        break;
      case 71:
        this.socket.emit('immersion');
        break;
    }
  };

  // скрываем видео которое не видно и показываем то, которое видно
  panoClient.prototype.checkVisibility = function(pos) {
    pos*=-1;
    var index = this.videos.length,
        right = pos+this.width,
        code;

    while(index--){

      scrn = index*4096;
      if(
        (pos<scrn+4096+this.delta)&&
        (right>scrn-this.delta)
      ){

        if(this.videos[index].paused==true){
          this.syncAbsoluteAndPlay(this.videos[index]);
        }

      }else{
        
        if(
          (index==3)&&
          (pos<=this.delta)
        ){
          if(this.videos[index].paused==true){
            this.syncAbsoluteAndPlay(this.videos[3]);
          }
          continue;
        }

        if(
          (index==0)&&
          (pos+this.width>=16384-this.delta)
        ){
          if(this.videos[index].paused==true){
            this.syncAbsoluteAndPlay(this.videos[0]);
          }
          continue;
        }

        if(this.videos[index].paused==false){
          this.videos[index].pause();
          this.videos[index].style.display = "none";
        }
      }

    }


  };

  panoClient.prototype.animationLoop = function() {
    if(this.changed){

      var pos = this.position-this.offset;
      pos = pos % 12288;

      if(pos>=0){
        pos-=12288;
        // console.log('переход вперед от ', pos+12288, ' к ', pos);
      }else if((pos-this.width)<=-16384){
        pos+=12288;
        // console.log('переход назад от ', pos-12288, ' к ', pos);
      }

      // this.checkVisibility(pos);

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

  panoClient.prototype.connectToServer = function(){
    this.socket = io.connect(this.server, { query: "index="+this.video.getAttribute('data-screen') });
    this.socket.on("position", $.proxy(this.positionChange,this));
    this.socket.on("canvasDetails", $.proxy(this.canvasDetails,this));
    this.socket.on("reconnect", $.proxy(this.resize,this));
    this.socket.on("startTime", $.proxy(this.timeSync,this));
    this.socket.on("emersion", $.proxy(this.emersion,this));
    this.socket.on("immersion", $.proxy(this.immersion,this));
    this.socket.on("gogogo", $.proxy(this.gogogo,this));
    this.resize();
  };

  panoClient.prototype.timeSync = function(startTime){
    this.start_time = startTime;
    var index = this.videos.length;

    while(index--){
      this.syncAbsoluteAndPlay(this.videos[index]);
    }

    this.changed = true;
  };

  panoClient.prototype.syncLocalAndStart = function(video){
    video.style.display = "block";
    video.play();

    var current_time = new Date().getTime()/1000,
        count = this.videos.length,
        sync_time = parseFloat(video.getAttribute('data-sync'),10),
        current_movie_time;

    for(var i=0;i<count;i++){
      if(this.videos[i].paused==false){
        current_movie_time = this.videos[i].currentTime;
      }
    }

    if(video.seeking){
      // console.log('оно еще ищет');
      return;
    }

    if(current_time-sync_time<this.sync_pause){
      // console.log('блокировка по паузе');
      return;
    }

    if(Math.abs(video.currentTime-current_movie_time)>this.seekDelta){
      // console.log('таймсик блока '+video.getAttribute('id')+' с '+video.currentTime+' на '+current_movie_time);
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

  panoClient.prototype.syncAbsoluteAndPlay = function(video){
    // video.style.display = "block";
    // video.play();

    // синхронизация с расчетным временем
    var current_time = new Date().getTime()/1000,
        sync_time = parseFloat(video.getAttribute('data-sync'),10),
        time_passed = current_time - this.start_time,
        current_movie_time = time_passed % this.video_p1.duration;

    // console.log(current_time-sync_time, this.sync_pause);
    if(video.seeking){
      // console.log('оно еще ищет');
      return;
    }
    if(current_time-sync_time<this.sync_pause){
      // console.log('блокировка по паузе');
      return;
    }

    if(Math.abs(video.currentTime-current_movie_time)>this.seekDelta){
      // console.log('таймсик блока '+video.getAttribute('id')+' с '+video.currentTime+' на '+current_movie_time);

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
    // if(this.posFlag==false){
    //   return;
    // }
    // setTimeout($.proxy(function(){this.posFlag = true;},this),50);
    // this.posFlag = false;
    this.socket.emit('position',event.deltaY);
  };

  $(window).load(onDOMReady);

  function onDOMReady(){
    global.panoClient = new panoClient;
  }

})(this);
