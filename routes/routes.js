var db = require('../models/database.js');
var shajs = require('sha.js');

// TODO The code for your own routes should go here

var logout = function(req, res) {
	//null username with log out
	if (req.session.username != null){
		db.update_active_status(req.session.username, 0, function(err,data){
			if (err){
				//unable to update
				console.log("active status not updated");
			} else if (data){
				//success
				console.log("active status updated");
			} else {console.log("active status not updated");}
		});
		
		req.session.destroy();
		console.log("nulled");
		
		res.redirect(301, '/');
		return;
	}
};

var getMain = function(req, res) {
  //if the url (req.query) contains certain error message, pass in to main.ejs
	if (req.query.error != null){
		res.render('main.ejs', {error: req.query.error});
	} else {
		if (req.session.username != null) {
			req.session.destroy();
		}
		//else render main normally
		res.render('main.ejs', {error: null});
	}
};


var getWall = function(req, res) {
  //if the url (req.query) contains certain error message, pass in to main.ejs
	if (req.query.error != null){
		res.render('wall.ejs', {error: req.query.error});
	} else {
		//else render main normally
		if (req.session.username == null) {
			res.redirect('/');
		} else {
			// scan all restaurants 
			var wallUsername = req.url.split("username=")[1];
			
			var posts = [];
			db.get_postee_post(wallUsername, function(err, data) {
				if (err) {
					// need to do error handling if username doesn't exist'
					console.log("Error looking up posts by postee name.");
				} else if (data) {
					for (let i = 0; i < data.Items.length; i++) {
						posts.push(data.Items[i]);
					}
					db.get_poster_post(wallUsername, function(err, data) {
						if (err) {
							console.log("Error looking up posts by poster name.");
						} else if (data) {
							for (let i = 0; i < data.Items.length; i++) {
								posts.push(data.Items[i]);
							}
							
							function compare( a, b ) {
							  if ( a.timestamp.S > b.timestamp.S ){
							    return -1;
							  }
							  if ( a.timestamp.S < b.timestamp.S ){
							    return 1;
							  }
							  return 0;
							}
							
							
							posts.sort( compare );
							var postsPostee = posts;
							var promises = [];
							for (let k = 0; k < postsPostee.length; k++) {
								postsPostee[k].comments = [];
								var promise = new Promise((resolve, reject) => 
									db.get_comments(postsPostee[k].postID.S, function(err, data) {
										if (err) {
											reject(err);
											console.log("Error looking up posts by postee name.")
										} else if (data) {
											data.Items.sort( compare );
											postsPostee[k].comments.push(data.Items);
											resolve(data.Items);
										}
									})
								)
								promises.push(promise);
							}
							console.log("Promises are " + promises);
							Promise.all(promises).then((values) => {
								res.render('wall.ejs', {posts: postsPostee, username: wallUsername});
					
							})
						}
						
					})
					
				}
			});

			
		}
		//res.render('wall.ejs', {error: null, username: wallUsername});
	}
};

var getHomepage = function(req, res) {
  //if the url (req.query) contains certain error message, pass in to main.ejs
	if (req.query.error != null){
		res.render('homepage.ejs', {error: req.query.error});
	} else {
		//else render main normally
		if (req.session.username == null) {
			res.redirect('/');
		} else {
			// get all data
			db.get_friends(req.session.username, function(err, data) {
				if (err) {
					console.log("Error looking up friends.");
				} else if (data) {
					// Friends should include myself
					var friends = data.Items;
					var friendList = [];
					var postsPostee = [];
					var promises = [];
					for (let i = 0; i < friends.length; i++) {
						friendList.push(friends[i].friend.S);
						var promise = new Promise((resolve, reject) => 
							db.get_postee_post(friends[i].friend.S, function(err, data) {
								if (err) {
									reject(err);
									console.log("Error looking up posts by postee name.")
								} else if (data) {
									for (let j = 0; j < data.Items.length; j++) {
										postsPostee.push(data.Items[j]);
									}
									resolve(data.Items);
								}
							})
						)
						promises.push(promise);
						
					}
					var promise = new Promise((resolve, reject) => 
							db.get_postee_post(req.session.username, function(err, data) {
								if (err) {
									reject(err);
									console.log("Error looking up posts by postee name.")
								} else if (data) {
									for (let j = 0; j < data.Items.length; j++) {
										postsPostee.push(data.Items[j]);
									}	
									resolve(data.Items);
								}
							})
						)
					promises.push(promise);
					
					Promise.all(promises).then((values) => {
						function compare( a, b ) {
						  if ( a.timestamp.S > b.timestamp.S ){
						    return -1;
						  }
						  if ( a.timestamp.S < b.timestamp.S ){
						    return 1;
						  }
						  return 0;
						}
						
						
						postsPostee.sort( compare );
						var promises = [];
						for (let k = 0; k < postsPostee.length; k++) {
							postsPostee[k].comments = [];
							var promise = new Promise((resolve, reject) => 
								db.get_comments(postsPostee[k].postID.S, function(err, data) {
									if (err) {
										reject(err);
										console.log("Error looking up posts by postee name.")
									} else if (data) {
										data.Items.sort( compare );
										postsPostee[k].comments.push(data.Items);
										resolve(data.Items);
									}
								})
							)
							promises.push(promise);
						}
						Promise.all(promises).then((values) => {
							res.render('homepage.ejs', {friendList: friendList, postsByPostee: postsPostee, username: req.session.username, message: req.session.message, error: req.session.error});
				
						})
						
					});
					
				}
			})

		}
	}
};

var comment = function(req, res) {
	console.log("comments are " + JSON.stringify(req.body));
	var comment = req.body.comment;
	var wallUsername = req.url.split("wall=")[1];
	if (comment === "") {
		if (wallUsername === "No") {
			res.redirect(301, '/homepage');
			return;
		} else {
			res.redirect(301, '/homepage');
			return;
		}
	}
	
	db.put_comment(comment, req.body.postID, req.session.username, req.body.DateTime, function(err, data) {
		if (err) {
			console.log("Error putting a comment: " + err);
			res.redirect("/homepage")
		} else if (data) {
			console.log("Successfully put a comment.")
			if (wallUsername === "No") {
				res.redirect('/homepage');
			} else {
				res.redirect('/wall?username='.concat(wallUsername));
			}
		}
	})
}

var postStatusUpdate = function(req, res) {
	var statusUpdate = req.body.statusUpdate;
	if (statusUpdate === "") {
		res.redirect(301, '/homepage');
		return;
	}
	
	db.put_postee(req.session.username, req.session.username, req.body.DateTime, statusUpdate, req.body.postID, function(err, data) {
    if (err) {
      console.log("put status update unsuccessful" + err);
      res.redirect(301, '/?error=2');
    } else if (data){
	  console.log("put status update successful");
	  //let session remember that user logged in
	  res.redirect(301, '/homepage');

	}
  });
};
var post = function(req, res) {
	
	var wallUsername = req.url.split("username=")[1];
	var post2 = req.body.post;
	if (post2 == "") {
		// Need to do further error handling
		res.redirect(301, '/wall?username='.concat(wallUsername));
		return;
	}
	db.put_postee(wallUsername, req.session.username, req.body.DateTime, post2, req.body.postID, function(err, data) {
    if (err) {
      console.log("put post unsuccessful" + err);
      res.redirect(301, '/?error=2');
    } else if (data){
	  console.log("put post successful");
	  //let session remember that user logged in
	  if (req.session.username !== wallUsername) {
		  db.put_poster(req.session.username, wallUsername, req.body.DateTime, post2, req.body.postID, function(err, data) {
		    if (err) {
		      console.log("put post unsuccessful" + err);
		      res.redirect(301, '/?error=2');
		    } else if (data){
			  console.log("put post successful");
			  //let session remember that user logged in
			  res.redirect('/wall?username='.concat(wallUsername));
		
			}
	 	}

	
  )} else {
	res.redirect('/wall?username='.concat(wallUsername));
		
}
  }
  })};

var getAllChats = function(req, res) {
	if (req.query.error != null){
		res.render('main.ejs', {error: req.query.error});
	} else {
		//else render all chats normally
		res.render('allChats.ejs', {error: req.session.inviteErr});
	}

};

// gets username of user that is currently logged in
var getCurrUser = function(req, res) {
	res.send(req.session.username);
}

// gets the ID of the current chat a user is in
var getCurrChat = function(req, res) {
	res.send(req.session.chatID);
}

// gets the usernames of user in a chat
var getChatMember = function(req, res) {
	res.send(req.session.chatMember);
}

// gets if user just joined the chat (for groupchat notifications)
var getJoinedChat = function(req, res) {
	res.send(req.session.joinedChat);
}

// get error for joining chat
var getInviteErr = function(req, res) {
	res.send(req.session.inviteErr);
}

// get if chat is a groupchat
var getIsGroup = function(req, res) {
	res.send(req.session.groupchat);
}

// get all chat notifications for a user
var getChatNotifs = function(req, res) {	
	console.log("IN CHATNOTIFS: " + req.session.username);
	
  	db.getChatNotifs(req.session.username, function(err, data) {
    	if (err) {
		  console.log("error getting notifs: " + err);
	      res.render('allChats.ejs', {error: req.query.error});
	    } else if (data) {
		  console.log("successful getting notifs: " + JSON.stringify(data));
	      res.send(data.chatNotifs);
	    }
	  });
};

// delete chat notif
var deleteChatNotif = function(req, res) {	
	console.log("IN DELETECHATNOTIF: " + req.body.sender);
	
	// invitee, sender
  	db.deleteChatNotif(req.session.username, req.body.sender, function(err, data) {
    	if (err) {
		  console.log("error deleting notifs: " + err);
	      res.render('allChats.ejs', {error: req.query.error});
	    } else if (data) {
		  console.log("successful deleting notif: " + JSON.stringify(data));
	      res.end();
	    }
	  });
};

/*var inviteChat = function(req, res) {
	console.log("REQ.BODY: " + JSON.stringify(req.body));
	console.log("INPUT: " + req.body.username);
	
  	db.invite_chat(req.body.username, req.session.username, function(err, data) { */
  	
var restaurants = function(req, res) {
  
	res.render('restaurants.ejs');
}

var getInviteChat = function(req, res) {
	if (req.body.username != req.session.username) {
	  	db.inviteChat(req.body.username, req.session.username, function(err, data) {
	    	if (err) {
		      res.render('allChats.ejs', {error: req.query.error});
		    } else if (data != null) {
			console.log("DATA NOT NULL ROUTES");
			  if (data.error != null) {
				console.log("SETTING INVITERROR");
				req.session.inviteErr = data.error;
				res.redirect('/allchats');
			  } else {
				  console.log("redirecting to single chat");
				  req.session.chatID = data.chatID; // UUID passed back
				  req.session.inviteErr = "None";
	
				  if (req.session.groupchat == null || !req.session.groupchat) {
					console.log("SETTING CHAT MEM");
					console.log("RE GC: " + req.session.groupchat);
					req.session.chatMember = [req.body.username];
				  }
				  
				  req.session.messages = data.messsages;
			      // res.redirect('/singlechat');
			      res.end();
			  }
		    }
		  });
	} else {
		req.session.inviteErr = "Invalid invite";
		res.end();
	}
};

var postLeaveChat = function(req, res) {
	console.log("POST LEAVE CHAT ROUTE: " + req.body.groupchatID);
  	db.leaveChat(req.body.groupchatID, req.session.username, function(err, data) {
    	if (err) {
		  console.log("ERROR DELETING NOW IN ROUTES: " + req.query.error);
	      res.render('singleChat.ejs', {error: req.query.error});
	    } else if (data != null) { // user successfully left chat
		  console.log("success, leave chat");
		  
		  // reset fields
		  // TODO: other fields???
		  req.session.chatID = null;
		  
		  if (req.session.groupchat != null && req.session.groupchat) {
			req.session.groupchat = false;
		  }	
		  
		  res.render('allChats.ejs', {error: "Left chat "});
	    }
	  });
};

var postAddToChat = function(req, res) {
	console.log("IN POST ADDTOCHAT ROUTE");
	// username of person being invited
  	db.addToChat(req.body.username, req.body.sender, req.body.chatID, req.session.groupchat, req.body.chatID, function(err, data) {
    	if (err) {
			console.log("Error postAddToChat routes.js");
	      res.render('singleChat.ejs', {error: req.query.error});
	    } else if (data != null) { // user added to chat
		  console.log("successful addtochat");
		  
		  // TODO HERE: conditional if was already a group chat or not
		  // if groupchat already, update chatMember, (emit to chatID room) all existing members get message that person joined
		  // must send invite to new user separately somehow
		  
		  if (req.session.groupchat == null || !req.session.groupchat) {
			  var chatMembers = [];
		  
			  // create array of all chat members
			  for (var i = 0; i < data.members.length; i += 1) {
				chatMembers.push(data.members[i].username.S);
			  }
			  
			  // include newly added member
			  chatMembers.push(req.body.username);
			  
			  req.session.chatMember = chatMembers;
		  } else {
			req.session.chatMember.push(req.body.username);
		}
		  
		  req.session.joinedChat = false;
		  req.session.groupchat = true;
		  req.session.messages = data.messsages; // if there is existing chat?
		  req.session.chatID = data.chatID; // UUID passed back
		  
		  // rendering would depend on whether there was an existing chat or not
		  // existing chat: redirect to that chatID (set session chatID), set session param to indicate
		  // that there should be a redirection to /singlechat
		  // TODO: HOW DO YOU ALSO REDIRECT EVERYONE ELSE TO THAT CHAT?? I don't think you can ...
		  // SPEC: MUST OPEN A NEW CHAT SESSION
		  
		  // all that a new chat session means is switching all group chat members' chatID
		  // emit a message to every person's room, not necessarily a displayed message, but if
		  // something emitted, then set new chatID and redirect window location (how do you reset session chatID)
		  
		  // messages in this new chat are either blank or persistent
		  
		  // new chat: redirect to that 
	      res.end();
	    } else {
		  console.log("user not online for being added to chat");
		  res.render('singleChat.ejs', {error: "User is not online for chatting"});
	    }
	  });
};

var sendMessage = function(req, res) {
	console.log("REQ.BODY: " + JSON.stringify(req.body));
	
	// chatID, message text, sender
  	db.send_message(req.session.chatID, req.body.text, req.session.username, function(err, data) {
    	if (err) {
		  console.log("error sending message: " + err);
	      res.render('singleChat.ejs', {error: req.query.error});
	    } else if (data) {
		  console.log("successful message post");
		  if (req.session.messages != null) {
			req.session.messages.push(req.body.text);
		  }

	      res.end();
	    }
	  });
};

// get messages from a specific chat
var chatInfo = function(req, res) {	
	console.log("IN CHATINFO: " + req.body.groupchatID);
	
  	db.getChatInfo(req.body.groupchatID, function(err, data) {
    	if (err) {
		  console.log("error getting messages: " + err);
	      res.render('singleChat.ejs', {error: req.query.error});
	    } else if (data) {
		  console.log("successful getting messages");
		  req.session.messages = data.messages;
		  req.session.chatID = data.chatID;
		  		  
		  var chatMembers = [];
		  
		  // create array of all chat members
		  for (var i = 0; i < data.members.length; i += 1) {
			chatMembers.push(data.members[i].username.S);
		  }
		  
		 /* if (chatMembers.length > 2) {
			req.session.groupchat = true;
		}*/
		  
		  // include newly added member
		  //chatMembers.push(req.body.username);
		  
		  req.session.chatMember = chatMembers;
		  req.session.joinedChat = true; // for tracking if notifications need to be sent
	      res.end();
	    }
	  });
};

var getSingleChat = function(req, res) {
	if (req.query.error != null){
		console.log("error rendering single: " + req.query.error);
		res.render('allChats.ejs', {error: req.query.error});
	} else {
		//else render single chats normally
		// res.render('singleChat.ejs', {member: req.session.chatMember, currUser: req.session.username});
	    console.log("rendering single: " + req.session.username + " Members: " + req.session.chatMember);
	    res.render('singleChat.ejs', {messages: req.session.messages, member: req.session.chatMember, currUser: req.session.username, currRoom: req.session.chatID});
	}
};

//ACCOUNT OPS
var signup = function(req, res) {
	res.render('signup.ejs', {});
};

var createAcct = function(req, res) {
	
	console.log(JSON.stringify(req.body));
  //Check if all 3 inputs are present
  //check if mySelect >=3
  if (req.body.username == "" || req.body.password == "" || req.body.firstname == "" 
  || req.body.lastname == "" || req.body.email == "" || req.body.affiliation == "" || req.body.birthday == ""
  || req.body.mySelect.length < 3){
	//if not, account creation fails
	res.redirect(301, '/?error=2');
	return;
  }
  //req.body.mySelect will be an array of strings w categories
  
  var uname = req.body.username;
  //hash password with sha256
  var psw = shajs('sha256').update(req.body.password).digest('hex');
  var fname = req.body.firstname;
  var lname = req.body.lastname;
  var emil = req.body.email;
  var affil = req.body.affiliation;
  var bday = req.body.birthday;
  
  //u_put by design will error if user already exists.
  db.u_put(uname, psw, fname, lname, emil, affil, bday, function(err, data) {
    if (err) {
      console.log("put user unsuccessful" + err);
      res.redirect(301, '/?error=2');
    } else if (data){
	  console.log("put user successful");
	  //let session remember that user logged in
	  req.session.username = uname;

	  //put in user interests
      console.log ("Can i see this pref" + req.body.mySelect[0]);
	  for (let i = 0; i < req.body.mySelect.length; i++){
		console.log ("PUTTING THIS PREF right now" + req.body.mySelect[i]);
		db.newsPref_put(uname, req.body.mySelect[i], function(err, data){
			if (err) {
		      console.log("put pref unsuccessful" + err);
		    } else if (data){
			  console.log("put pref successful");
			}
		})	
	  }	  
	  
	  for (let i = 0; i < uname.length; i++) {
		db.put_prefixes(uname.slice(0, i+1), uname, function(err, data) {
			if (err) {
				console.log("Error putting prefixes to db.")
			} else if (data) {
				console.log("Successfully put prefixes.")
			}
		})
	  }
	  
	  req.session.message = null;
	  //res.redirect(301, 'http://localhost:8080/restaurants');
	  res.redirect(301, '/homepage');
	 
	}
  });
  
};


var checkLogin = function(req, res) {
	//check if both arguments are present, if not, log in fails
	
	if (req.body.username == "" || req.body.password == "" ){
		console.log('user here' + req.body.password);
		res.redirect(301, '/?error=1');
		return;
	}
	
  console.log("here's check:" + req.body.username);
  var userName = req.body.username;
  //compare the SHA-256 hashed value of the password
  var userPass = shajs('sha256').update(req.body.password).digest('hex');
  
  //check credentials
  db.lookup(userName, function(err, data) {
    if (err) {
		//search username error: send back to log in
      //res.redirect(301, 'http://localhost:8080?error=1');
      res.redirect(301, '/?error=1');
    } else if (data) {
	
	  //user found, check if password is right
	  if (data.password.S == userPass){
		console.log("right password!");
		//password correct, log user in session and send to restaurant
		req.session.username = userName;
		req.session.message = null;
		res.redirect(301, '/homepage');
		//res.redirect(301, 'http://localhost:8080/restaurants');
		db.update_active_status(userName, 1, function(err,data){
			if (err){
				//unable to update
				console.log("active status not updated");
			} else if (data){
				//success
				console.log("active status updated");
			} else {console.log("active status not updated");}
		});
		
	  } else {
		console.log("wrong password!");
		//password incorrect, log in fails
		res.redirect(301, '/?error=1');
	  }
    } else {
	  //User not found, log in fails
      res.redirect(301, '/?error=1');
    }
  });
};

var account = function(req, res) {
	//if user is not logged in, send them back to main TODO
	res.render('account.ejs', {username: req.session.username, error: null});
};

var accountChange = function(req, res) {
  //Check if all 3 inputs are present
  //console.log("here's req body:" + JSON.stringify(req));
  //if user filled in no fields, but selected >=3 news preference, we allow;
  //if user filled in fields, but selected 1-2 news preference, we don't allow
  //if user filled in fields, but selected 0 news preference, we allow (no change on news preference)

//if user chose any pre
 
	  if (req.body.password == "" && req.body.email == "" && req.body.affiliation == ""){
		if (req.body.mySelect == null){
			//nothing is selected, fail
			console.log("no change filled in");
			//res.redirect(301, '/account?error=1');
			res.render("account.ejs", {username: req.session.username, error: 1});
			return;
		} else if (req.body.mySelect.length < 3){
			//account creation fails
			console.log("no change filled in");
			//res.redirect(301, '/account?error=1');
			res.render("account.ejs", {username: req.session.username, error: 1});
			return;
			//res.send({error:1});	
		}
	  } else {
		if (req.body.mySelect != null){
			if (req.body.mySelect.length < 3 && req.body.mySelect.length > 0){
				console.log("not enough news categories filled in");
		    	res.render("account.ejs", {username: req.session.username, error: 1});
			}
		}
		    
	}
  
  
  var new_psw;
  var new_emil = req.body.email;
  var new_affil = req.body.affiliation;
  //var news_category;
  var uname;
  var psw;
  var fname;
  var lname;
  var emil;
  var affil;
  var bday;
  
  //get the item first to get all fields
   db.lookup(req.session.username, function(err, data) {
    if (err) {
		//search username error: 
      res.render("account.ejs", {username: req.session.username, error: 2});
      console.log("user not found");
    } else if (data) {
		//user found, get all fields
		console.log("data here:" + JSON.stringify(data));
		uname = data.username.S;
		psw = data.password.S;
		fname = data.firstname.S;
		lname = data.lastname.S;
		emil = data.email.S;
		affil = data.affiliation.S;
		bday = data.birthday.S;
		
		  if (req.body.password != ""){
			new_psw = shajs('sha256').update(req.body.password).digest('hex')
			psw = new_psw;
		  }
		  
		  if (new_affil != ""){
			affil = new_affil;
			console.log("Affiliation is " + affil);
			console.log("Interests are " + req.body.mySelect);
			console.log("Body is " + JSON.stringify(req.body));
			var update = req.session.username + " is now affiliated with " + affil + ".";
			db.put_postee(req.session.username, req.session.username,req.body.DateTime, update, req.body.postID, function(err, data) {
				if (err) {
					console.log("Error posting affiliation update.");
				} else if (data) {
					console.log("Success posting affiliation update.");
				}
			});
		  }
		  
		  if (new_emil != ""){
			emil = new_emil;
			console.log('heres email' + emil);
		  }
		  
		  
		  db.u_update(uname, psw, fname, lname, emil, affil, bday, function(err, data) {
		    if (err) {
		      console.log("Update user unsuccessful" + err);
		
		      res.render("account.ejs", {username: req.session.username, error: 2});
		    } else if (data){
			  console.log("Update user successful");
			  if (req.body.mySelect != null){
			   if (req.body.mySelect.length >= 3){
				// add a post saying preferences are updated
				var update = req.session.username + " is now interested in "
				for (let i = 0; i < req.body.mySelect.length; i++) {
					update += req.body.mySelect[i];
					if (i != req.body.mySelect.length-1) {
						update += ", ";
					}
					if (i == req.body.mySelect.length-2) {
						update += "and ";
					}
				}
				update += ".";
				db.put_postee(req.session.username, req.session.username,req.body.DateTime, update, req.body.postID2, function(err, data) {
					if (err) {
						console.log("Error posting preference update.");
					} else if (data) {
						console.log("Success posting preference update.");
					}
				});
				
				//delete previous preferences
				db.newsPref_delete_all(uname, function(err, data) {
					    if (err) {
					      console.log("delete unsuccessful" + err);
					
					      res.render("account.ejs", {username: req.session.username, error: 2});
					    } else if (data){
						  console.log("pref feedbacks successful");
						  console.log(JSON.stringify(data))
						  for (let i = 0; i < req.body.mySelect.length; i++){
							console.log ("PUTTING THIS PREF right now" + req.body.mySelect[i]);
							db.newsPref_put(uname, req.body.mySelect[i], function(err, data){
								if (err) {
							      console.log("put pref unsuccessful" + err);
							    } else if (data){
								  console.log("put pref successful");
								}
							})	
						  }
						 
						  res.render("account.ejs", {username: req.session.username, error: 3});
						  return;
						}
					  });
				
				//put in the new preferences
				
				}
				} else {
				res.render("account.ejs", {username: req.session.username, error: 3});
				return;
				}

			}
		  });
		  
		  
    } else {
      res.render("account.ejs", {username: req.session.username, error: 2});
    }
  });
  
  
 
  
 
  
};

//FRIENDS OPERATIONS>>>>>
var getActive = function(req, res) {
	//req.body.username
	//look up the username's active status in users table'
	db.lookup(req.body.username ,function(err, data) {
	    if (err) {
			console.log(err);
	    } else if (data) {
			//send over restaurants
			//res.send(JSON.stringify(data));
			res.send(data);
	    } else {
			//send null if data is null
			res.send(null);
		}
	});
	
};

var add_friend = function(req, res) {
	
	//TODO: check if friend exists!!
	
  if (req.body.username == ""){
	//if not, add friend fails
	res.redirect(301, '/homepage');
	return;
  }
  
  //if friendname equals user name, don't allow the addition'
  
  var friendname = req.body.username;
  
  if (friendname == req.session.username){
	req.session.error = 3;
	res.redirect(301, '/homepage');
	return;
}
  
  //check if friend exists, if so, add friend.
  db.lookup(friendname, function(err, data){
	if (err) {
      console.log("Error adding friend: " + err);
      //res.redirect(301, '/homepage');
      //res.render('homepage.ejs', {message: 2});
      req.session.error = 2;
      res.redirect(301, '/homepage');
    } else if (data){
	  console.log("friend found");
	  
	  db.put_friend(req.session.username, friendname, function(err, data) {
	    if (err) {
	      console.log("put friend unsuccessful" + err);
	      req.session.error = 1;
	      res.redirect(301, '/homepage');
	      //res.render('homepage.ejs', {message: 1});
	      //res.redirect(301, '/homepage');
	      //res.render('homepage.ejs');
	      //res.redirect('/wall?username='.concat(wallUsername));
	    } else if (data){
		  console.log("put friend successful");
		  //window.alert("Successfully added " + friendname + ".");
		  //req.session.message = "Successfully added " + friendname + ".";
		  req.session.error = 0;
		  var friendPost = req.session.username + " added " + friendname + " as a friend.";
		  console.log("Time is " + JSON.stringify(req.body));
		  db.put_postee(friendname, req.session.username, req.body.DateTime, friendPost, req.body.postID, function(err, data) {
			if (err) {
				console.log("Error putting friendship update.");
			} else if (data) {
				console.log("Success in putting friendship update.");
				db.put_poster(req.session.username, friendname, req.body.DateTime, friendPost, req.body.postID, function(err, data) {
					if (err) {
						console.log("Error 2 putting friendship update.")
					} else if (data) {
						console.log("Success 2 in putting friendship update.")
						res.redirect(301, '/homepage');
					}
				})
				
				//res.render('homepage.ejs', {error: 0});
			}
		})
		  
		  
	
		} else {
		  //res.redirect(301, '/restaurants');
		  res.redirect(301, '/homepage');
		}
	  });
	  

	} else {
	  req.session.message = "Error adding friend: Username not found."
	  console.log("Unable to add friend");
	  res.redirect(301, '/homepage');
	}

});
};

//FRIEND VISUALIZER:
var initialize_friends = function(req, res) {
	console.log("HEREEEE");
	//this should just have one user: the current user.
	//get current user's name
	//check credentials
  var username = req.session.username;
  var ufirstname;
  var friends_arr = [];
  var json;
  db.lookup(username, function(err, data) {
    if (err) {
		//search username error: send back 
      //res.redirect(301, '/homepage');
    } else if (data) {
	  ufirstname = data.firstname.S;
	  json = {"id": username,"name": ufirstname,"children": friends_arr,
		        "data": []
		        };
	  db.friends_lookup(username, function(err, data) {
	    if (err) {
			//search username error: send back 
	      res.redirect(301, '/homepage');
	    } else if (data) {
		  var friends = data;
		  console.log("friends"+JSON.stringify(friends));
		  //data[0].friend.S
		  console.log("friends"+friends[0].friend.S);
		  //for EACH FRIEND:
		  for (let i = 0; i < friends.length; i++){
			db.lookup(friends[i].friend.S, function(err, data) {
		    if (err) {
				//search username error: send back 
		      //res.redirect(301, '/homepage');
		    } else if (data) {
			  var friendinfo = data;
			  
				//add friend to array.
				console.log("Adding friend" + friends[i].friend.S);
				var this_friend = {
			        "id": friends[i].friend.S,
			            "name": friendinfo.firstname.S,
			            "data": {},
			            "children": []
			    };
			    friends_arr.push(this_friend);
			    console.log(friends_arr);
			    
			    json = {"id": username,"name": ufirstname,"children": friends_arr,
		        "data": []
		        };
		        
			  
		    } else {
			  //User not found
		      //res.redirect(301, 'http://localhost:8080/homepage');
		    }
		  });
			
		  }
		
		} else {
			
		}
		});
	  
    } else {
	  //User not found, log in fails
      //res.redirect(301, 'http://localhost:8080/homepage');
    }
  });
  setTimeout(() => {console.log("this is the first message"); res.send(json);}, 1000);
	
}

var draw_new_friends = function(req, res) {
	//e.g. Alice is logged in
	//Spock is clicked
	// /getFriends/:spock
    console.log(req.params);
    //the user logged in (Alice)
    var coreuser = req.session.username;
    //the user clicked (Spock)
    var username = req.params.user;
    
    var friends_arr = [];
    var newFriends;
    
    //look up all friends of Spock
    db.friends_lookup(username, function(err, data) {
    if (err) {
		//search username error: send back 
      res.redirect(301, '/homepage');
    } else if (data) {
	  var friends = data;
	  console.log("friends"+JSON.stringify(friends));
	  //data[0].friend.S
	  console.log("friends"+friends[0].friend.S);
	  //for EACH FRIEND:
	  for (let i = 0; i < friends.length; i++){
		var friendaffil;
		//friends[i].friend.S will be each friend's username.
		//search up core user's affiliation & compare
		db.lookup(coreuser, function(err, data) {
	    if (err) {
			//search username error: send back 
	      //res.redirect(301, 'http://localhost:8080/homepage');
	    } else if (data) {
		  
		  coreaffil = data.affiliation.S;
		  console.log("FOund core user affil:" + coreaffil);
		  //search up friend's affiliation'
		  db.lookup(friends[i].friend.S, function(err, data) {
		    if (err) {
				//search username error: send back 
		      //res.redirect(301, 'http://localhost:8080/homepage');
		    } else if (data) {
			  var friendinfo = data;
			  friendaffil = friendinfo.affiliation.S;
			  //if friend's affiliation equals coreuser's affiliation, add to newFriends array
			  console.log("REACHED friend's affil" + friendaffil);
			  if (coreaffil == friendaffil){
				//add friend to array.
				console.log("Adding friend" + friends[i].friend.S);
				var this_friend = {
			        "id": friends[i].friend.S,
			            "name": friendinfo.firstname.S,
			            "data": {},
			            "children": []
			    };
			    friends_arr.push(this_friend);
			    console.log(friends_arr);
			    newFriends = {"id": username,"name": "a","children": friends_arr,
		        "data": []
		        };
		        
			  };
		    } else {
			  //User not found
		      //res.redirect(301, 'http://localhost:8080/homepage');
		    }
		  });
	    } else {
		  //User not found, log in fails
	      //res.redirect(301, 'http://localhost:8080/homepage');
	    }
	  });
		  //if same affiliation, add to array.
		
		
	  }
	  
    } else {
	  //User not found, log in fails
      res.redirect(301, '/homepage');
    }
  });
  setTimeout(() => {console.log("this is the first message"); res.send(newFriends);}, 1000);
    //get spock's friends who has the same affil with Alice
    //1. function that gets Spock's friends usernames.
    //2. for each username, get affil. check against Alice's affiliation.
    // if same, push it to children.
    
    //generate array of friends
    //get all of Spock's friends
    
    
    
    //put array of friends in newFriends
    
};

/**
renders newsfeed.ejs
 */
var newsfeed = function(req, res) {
	db.get_recommendations(req.session.username, function(err, data) {
		if (data) {
			res.render('newsfeed.ejs', {articles: data, username: req.session.username});
		} else {
			res.render('newsfeed.ejs', {articles: [], username: req.session.username});
		}
	});
};

var like_article = function(req, res) {
	var url = req.body.url;
	db.put_article(req.session.username, url, function (err, data) {
		res.send(req.session.username);
	});
}

var news_search = function(req, res) {
	var search = req.body.search;
	if (!search) {
		res.render('newssearch.ejs', {articles: []});
	}
	db.search_article(search, function(data) {
		if (data) {
			res.render('newssearch.ejs', {articles: data});
		} else {
			res.render('newssearch.ejs', {articles: []});
		}
	});
}

var get_suggestions = function(req, res) {
	var search = req.body.search;
	db.get_suggestions(search, function(err, data) {
		if (err) {
			console.log("Error looking up search suggestions.")
		} else if (data) {
			console.log("Suggestions found: " + data.Items);
			var suggestions = []
			for (let i = 0; i < data.Items.length; i++) {
				suggestions.push(data.Items[i].name.S);
			}
			res.send({suggestions: suggestions});
		}
	});
}

var routes = { 
  get_main: getMain,
  check_login: checkLogin,
  signup: signup,
  create_account: createAcct,
  get_all_chats: getAllChats,
  get_single_chat: getSingleChat,
  invite_chat: getInviteChat,
  get_curr_user: getCurrUser,
  send_message: sendMessage,
  get_curr_chat: getCurrChat,
  get_chat_member: getChatMember,
  restaurants: restaurants,
  account: account,
  account_change: accountChange,
  get_wall: getWall,
  get_homepage: getHomepage,
  post_status_update: postStatusUpdate,
  add_friend: add_friend,
  getActive: getActive,
  u_logout: logout,
  initialize_friends: initialize_friends,
  draw_new_friends: draw_new_friends,
  newsfeed: newsfeed,
  add_to_chat: postAddToChat,
  chat_info: chatInfo,
  joined_chat: getJoinedChat,
  post: post,
  leave_chat: postLeaveChat,
  like_article: like_article,
  comment: comment,
  invite_err: getInviteErr,
  chat_notifs: getChatNotifs,
  delete_notif: deleteChatNotif,
  is_group: getIsGroup,
  get_suggestions: get_suggestions,
  news_search: news_search,
};

module.exports = routes;
