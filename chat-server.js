// Require the packages we will use:
var http = require("http"),
   socketio = require("socket.io"),
   fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
   // This callback runs when a new connection is made to our HTTP server.

   fs.readFile("client.html", function(err, data){
      // This callback runs when the client.html file has been read from the filesystem.

      if(err) return resp.writeHead(500);
      resp.writeHead(200);
      resp.end(data);
   });
});
app.listen(5500);

var usernames = {};
var rooms = ['Lobby'];
var roomUser = {};
var creators = {};
var bannedRoom = {};
var privRoom = {};
var privPW = {};

// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
   // This callback runs when a new Socket.IO connection is established.

   socket.on('newUser', function(newId){
     
      roomUser[newId] = socket.id;
      
      socket.username = newId;
      socket.room = 'Lobby';
      usernames[newId] = newId;
      roomUser[newId] = socket.room;
      socket.join('Lobby');
      socket.emit('upadaterooms', rooms, 'Lobby');
    
      console.log("socket.username: " + socket.username);
      console.log("socket.room: " + socket.room);
      console.log("Usernames:" + Object.keys(usernames));
      io.sockets.in(socket.room).emit('user_to_client', {current_room:socket.room, current_user: roomUser});
   });

   
   socket.on('addRoom', function(newRoom, privateRoom, pw){
      if (privateRoom == 'y'){
         privRoom[newRoom] = newRoom;
         privPW[newRoom] = pw;
      }
      rooms.push(newRoom);
      console.log("Rooms: " + rooms);
      console.log("Private?: " + privateRoom);
      var creator = socket.username;
      creators[newRoom] = creator;
      console.log("Creator: " + creator);
      console.log("New Room: " + newRoom + "Creators: " + creators[newRoom]);
      io.sockets.emit('updaterooms', rooms, socket.room, privateRoom);
   });


   socket.on('changeRoom', function(room) {
      var curRoom, originRoom;
      var banP = socket.username;
      var banP_str = '' + banP;
      var room_str = '' + room;


      console.log("privRoom: " + privRoom[room_str.trim()]);
      if(privRoom[room_str.trim()] == room_str.trim()){
         socket.emit("pw_to_client", room);
      }
      else {
         curRoom = socket.room;
         originRoom = 'Lobby';
         socket.leave(socket.room);
         console.log("bannedRoom[]: " + bannedRoom[socket.username]);
         console.log("socket.usernam: " + socket.username);
         console.log("banP_str: " + banP_str);
         console.log("room: " + room_str.trim());
         if (bannedRoom[banP_str.trim()] == room){
               console.log("You're banned from this room");
               io.sockets.emit("updaterooms", rooms, originRoom);
         }
         else {
               socket.join(room);
               console.log("new room: " + room);
               roomUser[socket.username] = room;
               socket.emit('message_to_client', {message:'you have connected to ' + room});
               socket.broadcast.to(curRoom).emit('message_to_client', {message:socket.username + " has left the room"});
               socket.room = room;
               socket.broadcast.to(room).emit('message_to_client', {message: socket.username + " has joined the room"});
               io.sockets.emit('updaterooms', rooms, room);
               io.sockets.in(socket.room).emit('user_to_client', {current_room:socket.room, current_user: roomUser});
         }
      }
   
   });

   socket.on('correct', function(room, pw){
      var curRoom, originRoom;
      var banP = socket.username;
      var banP_str = '' + banP;
      var room_str = '' + room;
      curRoom = socket.room;
      originRoom = 'Lobby';
      var room_str = '' + room;
      var pw_str = '' + pw;
      if (bannedRoom[banP_str.trim()] == room){
               console.log("You're banned from this room");
               io.sockets.emit("updaterooms", rooms, originRoom);
         }
      
         
         else {
            if(privPW[room_str.trim()] == pw_str.trim()){
               socket.leave(socket.room);
               socket.join(room);
               console.log("new room: " + room);
               roomUser[socket.username] = room;
               socket.emit('message_to_client', {message:'you have connected to ' + room});
               socket.broadcast.to(curRoom).emit('message_to_client', {message:socket.username + " has left the room"});
               socket.room = room;
               socket.broadcast.to(room).emit('message_to_client', {message: socket.username + " has joined the room"});
               io.sockets.emit('updaterooms', rooms, room);
               io.sockets.in(socket.room).emit('user_to_client', {current_room:socket.room, current_user: roomUser});
         }
      }
   });



   socket.on('message_to_server', function(data) {
      // This callback runs when the server receives a new message from the client.
      console.log(socket.username+": "+data["message"]);
      console.log("cur room: " + socket.room); // log it to the Node.JS output
      io.sockets["in"](socket.room).emit("message_to_client",{message:socket.username+": "+data["message"] }); // broadcast the message to other users
   });

   socket.on('private_to_server', function(msg, to){
      var sender = socket.username;
      if(roomUser[sender] == roomUser[to]){
          socket.broadcast.to(roomUser[to]).emit('private_to_client', sender, msg);
      }
      else{
         console.log("user is not in the same room");
      }
     
   });



   socket.on('kick', function(data){
      var badUserKick = data.badUser;
      var curRoom = roomUser[badUserKick];
      var curRoom_str = '' + curRoom;

      if (socket.username == creators[curRoom_str.trim()]){
         io.sockets.in(curRoom).emit('kicked', badUserKick);
         roomUser[badUserKick] = 'Lobby';
      }
      else{
         console.log("You don't have authorization");
      }

   });

   socket.on('ban', function(data){
      var badUserBan = data.badUser;
      var curRoom = roomUser[badUserBan];
      var curRoom_str = '' + curRoom;
      
       bannedRoom[badUserBan] = curRoom;
       
       if(socket.username == creators[curRoom_str.trim()]){
          io.sockets.in(curRoom).emit('banned', badUserBan);
          roomUser[badUserBan] = 'Lobby';
        }else{

           console.log("You don't have authorization");
        }
   });
 });