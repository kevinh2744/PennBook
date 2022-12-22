/* Some initialization boilerplate. Also, we include the code from
   routes/routes.js, so we can have access to the routes. Note that
   we get back the object that is defined at the end of routes.js,
   and that we use the fields of that object (e.g., routes.get_main)
   to access the routes. */

var express = require('express');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var routes = require('./routes/routes.js');
var app = express();
app.use(express.urlencoded());app.use(express.urlencoded());
var session = require('express-session');
app.use(session({secret: 'loginSecret'}));


var http = require('http').Server(app);
var io = require('socket.io')(http);
const { exec } = require('child_process');

// static directory
app.use('/', express.static(__dirname + '/public'));



var cookieParser = require('cookie-parser')
var serveStatic = require('serve-static')
var path = require('path')


app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan('combined'));
app.use(cookieParser());
app.use(serveStatic(path.join(__dirname, 'public')))


/* Below we install the routes. The first argument is the URL that we
   are routing, and the second argument is the handler function that
   should be invoked when someone opens that URL. Note the difference
   between app.get and app.post; normal web requests are GETs, but
   POST is often used when submitting web forms ('method="post"'). */

app.get('/', routes.get_main);
//at route: http://localhost:8080/results
//app.post('/results', routes.post_results);

//logout & delete session username
app.post('/logout', routes.u_logout);

//check login
app.post('/checklogin', routes.check_login);
//this will get signup page
app.get('/signup', routes.signup);
//create account
app.post('/createaccount', routes.create_account);
// all chats a user is a part of
app.get('/allchats', routes.get_all_chats);
// get single chat
app.get('/singlechat', routes.get_single_chat);
// checking inviting a user to a chat
app.post('/invitechat', routes.invite_chat);
// get current user
app.get('/curruser', routes.get_curr_user);
// get info for a chat
app.post('/chatinfo', routes.chat_info);
// get if user just joined a chat
app.get('/joinedchat', routes.joined_chat);
// get if chat is a groupchat
app.get('/isgroup', routes.is_group);

// sending a message
app.post('/sendmessage', routes.send_message);
// get current chatID
app.get('/currchat', routes.get_curr_chat);
// get username of person invited to chat
app.get('/chatmember', routes.get_chat_member);
// invite another user to a chat
app.post('/addtochat', routes.add_to_chat);
// leave a chat
app.post('/leavechat', routes.leave_chat);
// error joining a chat
app.get('/inviteerr', routes.invite_err);
// get all chat notifications for a user
app.get('/chatnotifs', routes.chat_notifs);
// remove chat notification from table
app.post('/deletenotif', routes.delete_notif);

// socket programming for chat
io.on("connection", function (socket) {
	console.log("IN ON IN APP.JS");
	socket.on("chat message", obj => {
		console.log("IN CONNECTION CHAT MESSAGE");
		console.log("OBJ ROOM: " + obj.room)
		io.to(obj.room).emit("chat message", obj);
	});
	
	socket.on("join room", obj => {
		console.log("JOINED: " + obj.room);
		
		socket.join(obj.room);
	});
	
	socket.on("notifications", obj => {
		console.log("Notif joined: " + obj.room);
		
		socket.join(obj.room);
	});
	
	socket.on("chat invite", obj => {
		console.log("CHAT INVITE FOR: " + obj.invitee + " SENT BY: " + obj.sender + " ROOM: " + obj.chatID);
		io.to(obj.invitee).emit("chat invite", obj);
	});
	
	socket.on("groupchat invite", obj => {
		console.log("GROUPCHAT INVITE FOR: " + obj.invitee + " SENT BY: " + obj.sender + " ROOM: " + obj.chatID);
		io.to(obj.invitee).emit("groupchat invite", obj);
	});
	
	socket.on("leave chat", obj => {
		console.log("USER LEFT: " + obj.left + " SEND TO: " + obj.member);
		io.to(obj.member).emit("leave chat", obj);
		console.log("FINISHED LEAVE CHAT EMIT");
	});
})


//account change
app.get('/account', routes.account);

app.post('/accountchange', routes.account_change);

app.post('/addfriend', routes.add_friend);

app.post('/getactive', routes.getActive);
// newsfeed

app.get('/newsfeed', routes.newsfeed);

app.post('/likearticle', routes.like_article);

app.post('/newssearch', routes.news_search);

app.get('/runlivy', (req, res) => {
  exec('mvn exec:java@loader', { cwd: '/newsfeed' }, (err, stdout, stderr) => {
    res.json({ output: stdout });
  });
});

//TO BE DELETED
app.get('/restaurants', routes.restaurants);

app.get('/wall', routes.get_wall);
app.post('/comment', routes.comment);
app.post('/postStatusUpdate', routes.post_status_update);
app.get('/homepage', routes.get_homepage);
app.post('/post', routes.post);

//FRIENDS VISUALIZER
app.get('/friends', function(req, res) {
	console.log("HERES FRIENDS");
	res.render('friendvisualizer.ejs');
});


//friends
// if a & b are friends
// a     b
// b     a
//affil?
//find all friends for a
//for each friend...create the json

app.get('/friendvisualization', routes.initialize_friends);

//u is Alice. We clicked on user v.
// we bring in additional friends of the user v that share affiliation with the original u.
app.get('/getFriends/:user', routes.draw_new_friends);
app.post('/getSuggestions', routes.get_suggestions);
// TODO You will need to replace these routes with the ones specified in the handout
//app.post('/checklogin', routes.check_login);
//app.post("/createaccount", )

//send info to server - post
//getting info - get

/* Run the server */

console.log('Author: Group21');
http.listen(80);
console.log('Server running on port 8080. Now open http://localhost:8080/ in your browser!');
