(function(){

  function PanoServer(){
    var host =          '127.0.0.1',
        port =          '8080';

    this.start_time =   new Date().getTime()/1000;
    this.express =      require('express');
    this.app =          require('http').createServer(this.connectionHandler);
    this.io =           require('socket.io').listen(this.app);
    this.screens =      [
                          {'width':0, 'offset': 0}, 
                          {'width':0, 'offset': 0}, 
                          {'width':0, 'offset': 0}, 
                          {'width':0, 'offset': 0}
                        ];
    this.sockets =      [null, null, null, null];
    this.position =     -4096;
    this.timer =        0;

    // стартуем сервер
    this.app.listen(port, host);
    console.log('SocketIO - работает сервер на '+host+':'+port);

    // получение соединения сокета
    this.io.sockets.on('connection', this.socketConnected.bind(this));
  }

  // обрабатываем запросы не через socket.io
  PanoServer.prototype.connectionHandler = function(req, res){
    res.writeHead(200);
    res.end('SocketIO - работает сервер на '+host+':'+port);
  };

  // сообщение всем экранам
  PanoServer.prototype.broadcast = function(type, data){
    var index = this.sockets.length;
    while(index--){
      if(this.sockets[index]!=null){
        this.sockets[index].emit(type, data);
      }
    }
  };

  // расчет смещения экранов
  PanoServer.prototype.recountOffset = function(){
    var count = this.screens.length;
    while(count--){
      this.screens[count].offset = this.getOffset(count); 
      if(this.sockets[count]!=null){
        this.sockets[count].emit('canvasDetails', this.screens[count]);
      }
    }
    this.broadcast('position', this.position);
  };

  // расчет смещения конкретного экрана
  PanoServer.prototype.getOffset = function(index){
    var offset = 0,
        count = index;

    // console.log('!расчет для экрана '+index);

    while(count--){
      // console.log('размер экрана '+count, this.screens[count].width+"px");
      offset += this.screens[count].width;
    }

    // console.log('смещение экрана №'+index+': '+offset+'px');
    return offset;
  };

  // входящее соединение от экрана установлено
  PanoServer.prototype.socketConnected = function(socket){

    // console.log('присоединился экран №' + (socket.handshake.query.index-1));

    // сохранили номер экрана
    var screen_number = socket.handshake.query.index-1,
        server = this;

    // сохранили сокет
    server.sockets[screen_number] = socket;

    // передали время старта ролика
    socket.emit('startTime', server.start_time);

    // расчитали смещение экрана
    if(screen_number>0){
      server.screens[screen_number].offset = server.getOffset(screen_number);
    }

    // setInterval(function(){
    //   server.broadcast('sync',server.start_time);
    // }, 60000);

    // получили данные о разрешении экрана
    socket.on('disconnect', function(){
      // console.log('отсоединился экран №' + screen_number);
      server.screens[screen_number] = {'width':0, 'offset': 0};
      server.sockets[screen_number] = null;
    });

    // получили данные о разрешении экрана
    socket.on('dimensions', function(dimensions){
      // console.log('размер экрана №' + screen_number+ ": "+dimensions.width+"px");
      server.screens[screen_number].width = dimensions.width;
      server.recountOffset();
    });

    // получили скролл-смещение
    socket.on('position', function(pos){
      // console.log('получили смещение от экрана №' + screen_number+": "+pos+"px");
      server.position += pos;
      server.broadcast('position', server.position);
    });

    // сообщить всем о всплытии
    socket.on('emersion', function(){
      server.broadcast('emersion');
    });

    // сообщить всем о погружении
    socket.on('immersion', function(){
      server.ready_up = 0;
      server.ready_surface = 0;
      server.broadcast('immersion');
    });

    server.ready_up = 0;
    server.ready_surface = 0;

    // получено сообщение что экран готов к проигрыванию анимации поверхности
    socket.on('surfaceReady', function(){
      server.ready_surface++;
      var index = server.sockets.length,
          active = 0;
      while(index--){
        if(server.sockets[index]!=null){
          active++;
        }
      }
      if(active == server.ready_surface){
        server.start_time =   new Date().getTime()/1000;
        server.broadcast('surfaceStart', server.start_time);
      }
    });

    // получено сообщение что экран готов к проигрыванию анимации всплытия
    socket.on('emersionReady', function(){
      server.ready_up++;
      var index = server.sockets.length,
          active = 0;
      while(index--){
        if(server.sockets[index]!=null){
          active++;
        }
      }
      if(active == server.ready_up){
        server.start_time =   new Date().getTime()/1000;
        server.broadcast('emersionStart', server.start_time);
      }
    });



  };

  new PanoServer();

})();