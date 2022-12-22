var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();

// for chat ID generation
var { v4: uuidv4 } = require('uuid');

/* The function below is an example of a database method. Whenever you need to 
   access your database, you should define a function (myDB_addUser, myDB_getPassword, ...)
   and call that function from your routes - don't just call DynamoDB directly!
   This makes it much easier to make changes to your database schema. */


//looks up individual user
var user_lookup = async function(searchTerm, callback) {
  //console.log('Looking up: ' + searchTerm); 
  //initialize param
  var params = {
            KeyConditionExpression: 'username = :username',
            ExpressionAttributeValues: {
                ':username': {'S': searchTerm}
            },
            TableName: "users"
        };
  
  //query
  db.query(params, function(err, data) {
    if (err || data.Items.length == 0) {
	  console.log('not found'); 
      callback(err, null);
    } else {
	  //send user info back
	  console.log('Found'); 
      callback(err, data.Items[0]);
    }
  });
}

//search friends
var friends_lookup = async function(searchTerm, callback) {
  console.log('Looking up friends of: ' + searchTerm); 
  //initialize param
  var params = {
            KeyConditionExpression: 'username = :username',
            ExpressionAttributeValues: {
                ':username': {'S': searchTerm}
            },
            TableName: "friends"
        };
  
  //query
  db.query(params, function(err, data) {
    if (err || data.Items.length == 0) {
	  console.log('not found'); 
      callback(err, null);
    } else {
	  //send user info back
	  console.log('Found'); 
      callback(err, data.Items);
    }
  });
}

var update_active_status = async function(username, status, callback) {
	//1 for active; 0 for inactive
  console.log('Looking up active of: ' + username); 
  console.log('Adding status of: ' + status); 
  //initialize param

	
  var params = {  
    "TableName" : "users",
    "Key" : {
        "username" : {"S" : username}
    },
    "UpdateExpression" : "SET #attrName =:attrValue",
    "ExpressionAttributeNames" : {
        "#attrName" : "Active"
    },
    "ExpressionAttributeValues" : {
        ":attrValue" : {
            "S" : status.toString()
        }
    }
};
	
  //query
  db.updateItem(params, function(err, data) {
	console.log(JSON.stringify(data));
    if (err) {
	  console.log('not found'); 
	  console.log(err); 
      callback(err, null);
    } else {
	  //send user info back
	  console.log('Found'); 
      callback(err, "success");
    }
  });
}

var put_prefixes = function(prefix, name, callback) {

  var params = {
  TableName: 'prefixes',
  Item: {
    'prefix' : {S: prefix},
    'name' : {S: name}
  	},
  };
  //put operation
  db.putItem(params, function(err, data) {
  if (err) {
    callback(err, null);
  } else {
    callback(err, "successfully posted post");
  }
  });
  
}

var put_comment = function(comment, postID, poster, timestamp, callback) {

  var params = {
  TableName: 'comments',
  Item: {
    'postID' : {S: postID},
    'poster' : {S: poster},
    'comment' : {S: comment},
    'timestamp' : {S: timestamp},
  	},
  };
  //put operation
  db.putItem(params, function(err, data) {
  if (err) {
    callback(err, null);
  } else {
    callback(err, "Successfully posted a comment.");
  }
  });
}

//add something to the postee's posts
var put_postee = function(postee, poster, time, statusUpdate, postID, callback) {

  var params = {
  TableName: 'postsByPostee',
  Item: {
    'postee' : {S: postee},
    'poster' : {S: poster},
    'content' : {S: statusUpdate},
    'timestamp' : {S: time},
    'postID': {S: postID}
  	},
  };
  //put operation
  db.putItem(params, function(err, data) {
  if (err) {
    callback(err, null);
  } else {
    callback(err, "successfully posted a post on postee");
  }
  });
  
}

var put_poster = function(poster, postee, time, post, postID, callback) {

  var params = {
  TableName: 'postsByPoster',
  Item: {
    'poster' : {S: poster},
    'postee' : {S: postee},
    'content' : {S: post},
    'timestamp' : {S: time},
    'postID': {S: postID}
  	},
  };
  //put operation
  db.putItem(params, function(err, data) {
  if (err) {
    callback(err, null);
  } else {
    callback(err, "successfully posted post");
  }
  });
  
}

//add new user
var user_put = function(uname, psw, fname, lname, emil, affil, bday, callback) {

  var params = {
  TableName: 'users',
  Item: {
    'username' : {S: uname},
    'password' : {S: psw},
    'firstname' : {S: fname},
    'lastname' : {S: lname},
    'email' : {S: emil},
    'affiliation' : {S: affil},
    'birthday' : {S: bday}
    
  },
  //ensures that put fails if user already exists
  ConditionExpression: "#username <> :username",
        ExpressionAttributeNames: { 
            "#username" : "username" 
         },
        ExpressionAttributeValues: {
            ":username": {"S": uname}
        }
  };
  //put operation
  db.putItem(params, function(err, data) {
  if (err) {
    callback(err, null);
  } else {
    callback(err, "success");
  }
  });
  
}

// looks up chat for invited user (other) and current user (current)
var invite_chat = function(other, current, callback) {
  console.log("OTHER: " + other);
  console.log("CURRENT: " + current);
  
  // check that other user is online
  var params = {
	        KeyConditionExpression: 'username = :other',
	        ExpressionAttributeValues: {
	            ':other': {'S': other},
	        },
	        ProjectionExpression: 'Active',
	        TableName: "users"
	    };
  
  db.query(params, function(err, data) {
	if (err) {
		console.log("Error querying users for active status: " + err);
	} else if (data.Items.length == 0) {
		console.log("User does not exist");
		callback(err, {error: "User does not exist"});
	} else {
		if (data.Items[0].Active.S == '1') {		
			  //query param
			  params = {
			            KeyConditionExpression: 'username = :other',
			            ExpressionAttributeValues: {
			                ':other': {'S': other},
			            },
			            ProjectionExpression: 'chatID',
			            TableName: "chats"
			        };
			  
			  // query
			  db.query(params, function(err, data) {
			    if (err) {
				  console.log('Error querying chats: ' + err); 
			      callback(err, null);
			    } else if (data.Items.length == 0) {
				  // create new chat between users
				  var newID = uuidv4(); // new unique chat ID
				  
				  // chats: put -> other (PK) and chatID (SK), current (PK) and chatID (SK)
				  // chat_members: put -> flipped entries from chats
				  
				  // entry in chats table for other
				  var putParams = {
			  		TableName: "chats",
			  		Item: {
						"username": {S: other},
						"chatID": {S: newID}
					}
			      };
			      
			      // create entry for new chat
			      db.putItem(putParams, function(err, data) {
					if (err) {
						console.log("Error", err)
					} else {
						console.log("Success", data)
					}
				  });
				  
				  // entry in chats table for current
				  putParams = {
			  		TableName: "chats",
			  		Item: {
						"username": {S: current},
						"chatID": {S: newID}
					}
			      };
			      
			      // create entry for new chat
			      db.putItem(putParams, function(err, data) {
					if (err) {
						console.log("Error", err)
					} else {
						console.log("Success", data)
					}
				  });
				  
				  // entry in members table for other
				  putParams = {
			  		TableName: "chat_members",
			  		Item: {
						"username": {S: other},
						"chatID": {S: newID}
					}
			      };
			      
			      // create entry for new chat
			      db.putItem(putParams, function(err, data) {
					if (err) {
						console.log("Error", err)
					} else {
						console.log("Success", data)
					}
				  });
				  
				  // entry in members table for current
				  putParams = {
			  		TableName: "chat_members",
			  		Item: {
						"username": {S: current},
						"chatID": {S: newID}
					}
			      };
			      
			      // create entry for new chat
			      db.putItem(putParams, function(err, data) {
					if (err) {
						console.log("Error", err)
					} else {
						console.log("Success", data)
					}
				  });
				  
				  var queryParams = {
			            KeyConditionExpression: 'invitee = :other AND sender = :current',
			            ExpressionAttributeValues: {
			                ':other': {'S': other},
			                ':current': {'S': current}
			            },
			            ProjectionExpression: 'chatID',
			            TableName: "chat_invites"
			      };
			  
				// query
				db.query(queryParams, function(err, data) {
					console.log("========================DATA: " + JSON.stringify(data));
					if (err) {
						console.log("Error", err);
					} else if (data.Items.length == 0) {
						console.log("NOTIF CREATED");
						  // put chat invite into database
						  putParams = {
					  		TableName: "chat_invites",
					  		Item: {
								"invitee": {S: other},
								"sender": {S: current},
								"chatID": {S: newID}
							}
					      };
					      
					      // create entry for chat invite
					      db.putItem(putParams, function(err, data) {
							if (err) {
								console.log("Error", err)
							} else {
								console.log("Successful invite creation", data)
							}
						  });
					}
				});
			      
				  callback(err, {chatID: newID, messages: null});
			    } else {
				  // verify that there is a chat between the two users
				  console.log("ALL CHATS THEY ARE PART OF: " + JSON.stringify(data.Items));
				  
				  	var invitesParams = {
			            KeyConditionExpression: 'invitee = :current AND sender = :other',
			            ExpressionAttributeValues: {
			                ':other': {'S': other},
			                ':current': {'S': current}
			            },
			            ProjectionExpression: 'chatID',
			            TableName: "chat_invites"
			      };
			  
				// query
				db.query(invitesParams, function(err, data) {
					console.log("********DATA: " + JSON.stringify(data));
					if (err) {
						console.log("Error", err);
					} else if (data.Items.length == 0) {
						// create new chat
						console.log("NEW NEW CHAT CREATED HERE");

						  // create new chat between users
						  var newID = uuidv4(); // new unique chat ID
						  
						  // chats: put -> other (PK) and chatID (SK), current (PK) and chatID (SK)
						  // chat_members: put -> flipped entries from chats
						  
						  // entry in chats table for other
						  var putParams = {
					  		TableName: "chats",
					  		Item: {
								"username": {S: other},
								"chatID": {S: newID}
							}
					      };
					      
					      // create entry for new chat
					      db.putItem(putParams, function(err, data) {
							if (err) {
								console.log("Error", err)
							} else {
								console.log("Success", data)
							}
						  });
						  
						  // entry in chats table for current
						  putParams = {
					  		TableName: "chats",
					  		Item: {
								"username": {S: current},
								"chatID": {S: newID}
							}
					      };
					      
					      // create entry for new chat
					      db.putItem(putParams, function(err, data) {
							if (err) {
								console.log("Error", err)
							} else {
								console.log("Success", data)
							}
						  });
						  
						  // entry in members table for other
						  putParams = {
					  		TableName: "chat_members",
					  		Item: {
								"username": {S: other},
								"chatID": {S: newID}
							}
					      };
					      
					      // create entry for new chat
					      db.putItem(putParams, function(err, data) {
							if (err) {
								console.log("Error", err)
							} else {
								console.log("Success", data)
							}
						  });
						  
						  // entry in members table for current
						  putParams = {
					  		TableName: "chat_members",
					  		Item: {
								"username": {S: current},
								"chatID": {S: newID}
							}
					      };
					      
					      // create entry for new chat
					      db.putItem(putParams, function(err, data) {
							if (err) {
								console.log("Error", err)
							} else {
								console.log("Success", data)
							}
						  });
						  
						  var queryParams = {
					            KeyConditionExpression: 'invitee = :other AND sender = :current',
					            ExpressionAttributeValues: {
					                ':other': {'S': other},
					                ':current': {'S': current}
					            },
					            ProjectionExpression: 'chatID',
					            TableName: "chat_invites"
					      };
					  
						// query
						db.query(queryParams, function(err, data) {
							console.log("&&&&&&&&DATA: " + JSON.stringify(data));
							if (err) {
								console.log("Error", err);
							} else if (data.Items.length == 0) {
								console.log("NOTIF CREATED");
								  // put chat invite into database
								  putParams = {
							  		TableName: "chat_invites",
							  		Item: {
										"invitee": {S: other},
										"sender": {S: current},
										"chatID": {S: newID}
									}
							      };
							      
							      // create entry for chat invite
							      db.putItem(putParams, function(err, data) {
									if (err) {
										console.log("Error", err)
									} else {
										console.log("Successful invite creation", data)
									}
								  });
							}
						});
					      
						  callback(err, {chatID: newID, messages: null});
					} else {
						var notifChatID = data.Items[0].chatID.S;
						
						var notifParams = {
					  		TableName: "chat_invites",
					  		Item: {
								"invitee": {S: other},
								"sender": {S: current},
								"chatID": {S: notifChatID}
							}
					      };
					      
					      // create entry for chat invite
					      db.putItem(notifParams, function(err, data) {
							if (err) {
								console.log("Error", err)
							} else {
								console.log("Successful invite creation", data)
							}
						  });
						
						// success, found chat, now query messages table
					    var messagesParams = {
				            KeyConditionExpression: 'chatID = :chat',
				            ExpressionAttributeValues: {
				                ':chat': {'S': notifChatID},
				            },
				            TableName: "messages"
				        };
				        
				        db.query(messagesParams, function(err, data2) {
							if (err) {
								console.log('error finding chatID in messages table')
							} else if (data2.Items.length != 0) { // messages exist
								// send back messages
								// sort by timestamp first?
								callback(err, {chatID: notifChatID, messsages: data2.Items});
							} else if (data2.Items.length == 0) { // chat was previously created but no messages sent
								callback(err, {chatID: notifChatID, messsages: null});
							}
						});
					}
				});
			
				  /*for (var i = 0; i < data.Items.length; i += 1) {
					// query chat_members table
				    var membersParams = {
			            KeyConditionExpression: 'chatID = :chat',
			            ExpressionAttributeValues: {
			                ':chat': {'S': data.Items[i].chatID.S},
			            },
			            ProjectionExpression: 'username',
			            TableName: "chat_members"
			        };
			        
			        console.log("ID: " + data.Items[i].chatID.S + " i: " + i);
			        var currChatID = data.Items[i].chatID.S;
			
			        
			        db.query(membersParams, function(err, data) {
						console.log("====i: " + i + " CURR CHAT ID HERE: " + currChatID + " MEMBERS: " + JSON.stringify(data.Items));
						// length of data array must be 2
						if (err) {
							console.log('error querying chat_members: ' + err);
						} else if (data.Items.length == 2 && 
						((data.Items[0].username.S == other && data.Items[1].username.S == current) || 
						(data.Items[0].username.S == current && data.Items[1].username.S == other))) {
							  // put chat invite into database
							  var inviteParams = {
						  		TableName: "chat_invites",
						  		Item: {
									"invitee": {S: other},
									"sender": {S: current},
									"chatID": {S: currChatID}
								}
						      };
						      
						      // create entry for chat invite
						      db.putItem(inviteParams, function(err, data) {
								if (err) {
									console.log("Error", err)
								} else {
									console.log("Successful invite creation", data)
								}
							  });
							  
							// success, found chat, now query messages table
						    var messagesParams = {
					            KeyConditionExpression: 'chatID = :chat',
					            ExpressionAttributeValues: {
					                ':chat': {'S': currChatID},
					            },
					            TableName: "messages"
					        };
					        
					        db.query(messagesParams, function(err, data2) {
								if (err) {
									console.log('error finding chatID in messages table')
								} else if (data2.Items.length != 0) { // messages exist
									// send back messages
									// sort by timestamp first?
									callback(err, {chatID: currChatID, messsages: data2.Items});
								} else if (data2.Items.length == 0) { // chat was previously created but no messages sent
									callback(err, {chatID: currChatID, messsages: null});
								}
							});
						} else { // create new chat
						console.log("NEEDS NEW CHAT");
							// create new chat between users
						  var newID = uuidv4(); // new unique chat ID
						  
						  // chats: put -> other (PK) and chatID (SK), current (PK) and chatID (SK)
						  // chat_members: put -> flipped entries from chats
						  
						  // entry in chats table for other
						  var putParams = {
					  		TableName: "chats",
					  		Item: {
								"username": {S: other},
								"chatID": {S: newID}
							}
					      };
					      
					      // create entry for new chat
					      db.putItem(putParams, function(err, data) {
							if (err) {
								console.log("Error", err)
							} else {
								console.log("Success", data)
							}
						  });
						  
						  // entry in chats table for current
						  putParams = {
					  		TableName: "chats",
					  		Item: {
								"username": {S: current},
								"chatID": {S: newID}
							}
					      };
					      
					      // create entry for new chat
					      db.putItem(putParams, function(err, data) {
							if (err) {
								console.log("Error", err)
							} else {
								console.log("Success", data)
							}
						  });
						  
						  // entry in members table for other
						  putParams = {
					  		TableName: "chat_members",
					  		Item: {
								"username": {S: other},
								"chatID": {S: newID}
							}
					      };
					      
					      // create entry for new chat
					      db.putItem(putParams, function(err, data) {
							if (err) {
								console.log("Error", err)
							} else {
								console.log("Success", data)
							}
						  });
						  
						  // entry in members table for current
						  putParams = {
					  		TableName: "chat_members",
					  		Item: {
								"username": {S: current},
								"chatID": {S: newID}
							}
					      };
					      
					      // create entry for new chat
					      db.putItem(putParams, function(err, data) {
							if (err) {
								console.log("Error", err)
							} else {
								console.log("Success", data)
							}
						  });
						  
						  var queryParams = {
					            KeyConditionExpression: 'invitee = :other AND sender = :current',
					            ExpressionAttributeValues: {
					                ':other': {'S': other},
					                ':current': {'S': current}
					            },
					            ProjectionExpression: 'chatID',
					            TableName: "chat_invites"
					      };
					  
						// query
						db.query(queryParams, function(err, data) {
							console.log("##############DATA: " + JSON.stringify(data));
							if (err) {
								console.log("Error", err);
							} else if (data.Items.length == 0) {
								console.log("NOTIF CREATED");
								  // put chat invite into database
								  putParams = {
							  		TableName: "chat_invites",
							  		Item: {
										"invitee": {S: other},
										"sender": {S: current},
										"chatID": {S: newID}
									}
							      };
							      
							      // create entry for chat invite
							      db.putItem(putParams, function(err, data) {
									if (err) {
										console.log("Error", err)
									} else {
										console.log("Successful invite creation", data)
									}
								  });
							}
						});
					      
						  callback(err, {chatID: newID, messages: null});
						}
						// TODO: ELSE?
					});
				  }*/
			    }
			  });
		} else {
			console.log("User is not online");
			callback(err, {error: "User is not online"});
		}
	}
  });
}

var delete_notif = function(invitee, sender, callback) {
  console.log("IN delete chat notif DB: " + invitee + " " + sender);
  
  var params = {
	  TableName: 'chat_invites',
	  Key: {
		invitee: {
			S: invitee
		},
		sender: {
			S: sender
		}
	  }
  };
  
  // delete from chat_invites
  db.deleteItem(params, function(err, data) {
	  if (err) {
		console.log("error with notif deletion chats table: " + err);
	    callback(err, null);
	  } else {
		console.log("SUCCESSFUL NOTIF DELETION");
		callback(err, data);
	}
  });
}

var leave_chat = function(chatID, username, callback) {
  console.log("IN LEAVE CHAT DB: " + username + " " + chatID);
  
  // chat_members: delete entry that has pk chatID and sk username
  // chats: delete all entry that has pk username and sk chatID 
  var params = {
	  TableName: 'chat_members',
	  Key: {
		chatID: {
			S: chatID
		},
		username: {
			S: username
		}
	  }
  };
  
  // delete from chat_members table
  db.deleteItem(params, function(err, data) {
	  if (err) {
		console.log("error with user deletion chat_members table: " + err);
	    callback(err, null);
	  }
  });
  
  params = {
	  TableName: 'chats',
	  Key: {
		chatID: {
			S: chatID
		},
		username: {
			S: username
		}
	  }
  };
  
  // delete from chats table
  db.deleteItem(params, function(err, data) {
	  if (err) {
		console.log("error with user deletion chats table: " + err);
	    callback(err, null);
	  } else {
		console.log("SUCCESSFUL USER DELETION CHATS");
		callback(err, data);
	}
  });
}

var add_to_chat = function(user, sender, currChat, groupchat, currChatID, callback) {
  // check is user is in current chat (query chats table)
  // TODO: CHECK IF ADDING PAST THIRD PERSON
  console.log("IN ADD TO CHAT DB: " + user + " " + currChat + " " + groupchat + " " + currChatID);
  //initialize param
  var params = {
            KeyConditionExpression: 'username = :user',
            ExpressionAttributeValues: {
                ':user': {'S': user},
            },
            ProjectionExpression: 'chatID',
            TableName: "chats"
        };
  
  // query
  db.query(params, function(err, data) {
    if (err) {
	  console.log('Error querying chats addToChat: ' + err); 
      callback(err, null);
    } else if (data.Items.length >= 0) {
	  if (data.Items.length > 0) {
		  // check if user is already in current chat
		  for (var i = 0; i < data.Items.length; i += 1) {
			if (data.Items[i].chatID == currChat) {
				callback(err, 'User already in chat');
			}
		  }
	  }
  
	  // user was not in current chat
	  if (groupchat == null || !groupchat) {
		console.log("~~~~~~~~NOT A GROUP CHAT");
		  // if was a two person chat, create new session
							  
		  // query chat_member table for all members of the current chat
		  params = {
	            KeyConditionExpression: 'chatID = :currChat',
	            ExpressionAttributeValues: {
	                ':currChat': {'S': currChat},
	            },
	            ProjectionExpression: 'username',
	            TableName: "chat_members"
	        };
	        
		  db.query(params, function(err, data) {
		    if (err) {
			  console.log('Error querying chat_members addToChat: ' + err); 
		      callback(err, null);
		    } else if (data.Items.length > 0) {
				// create new session
				var newID = uuidv4(); // new unique chat ID
				
				// create notification
				var inviteParams = {
			  		TableName: "chat_invites",
			  		Item: {
						"invitee": {S: user},
						"sender": {S: sender},
						"chatID": {S: newID}
					}
			      };
			      
			      // create entry for chat invite
			      db.putItem(inviteParams, function(err, data) {
					if (err) {
						console.log("Error", err)
					} else {
						console.log("Successful invite creation", data)
					}
				  });
				
				// add entries for each member to the chats and chat_members tables
				for (var i = 0; i < data.Items.length; i += 1) {
				  // entry in chats table
				  var putParams = {
			  		TableName: "chats",
			  		Item: {
						"username": {S: data.Items[i].username.S},
						"chatID": {S: newID}
					}
			      };
			      
			      // create entry for new chat
			      db.putItem(putParams, function(err, data) {
					if (err) {
						console.log("Error", err);
						callback(err, null);
					} else {
						console.log("Success", data);
					}
				  });
				  
				  putParams = {
			  		TableName: "chat_members",
			  		Item: {
						"username": {S: data.Items[i].username.S},
						"chatID": {S: newID}
					}
			      };
				  
				  // entry in chat_members table
			      db.putItem(putParams, function(err, data) {
					if (err) {
						console.log("Error", err)
						callback(err, null);
					} else {
						console.log("Success", data)
					}
				  });
				}
				
				// put newly invited user
				var putParams = {
			  		TableName: "chats",
			  		Item: {
						"username": {S: user},
						"chatID": {S: newID}
					}
			      };
			      
			      // create entry for new chat
			      db.putItem(putParams, function(err, data) {
					if (err) {
						console.log("Error", err);
						callback(err, null);
					} else {
						console.log("Success", data);
					}
				  });
				  
				  putParams = {
			  		TableName: "chat_members",
			  		Item: {
						"username": {S: user},
						"chatID": {S: newID}
					}
			      };
				  
				  // entry in chat_members table
			      db.putItem(putParams, function(err, data) {
					if (err) {
						console.log("Error", err)
						callback(err, null);
					} else {
						console.log("Success", data)
					}
				  });
				
				callback(err, {chatID: newID, messages: null, members: data.Items});
			}
		  });
	  } else {
		console.log("~~~~~~~~ALREADY A GROUP CHAT: " + user);

		// already a groupchat, add user to existing session
		var putParams = {
	  		TableName: "chats",
	  		Item: {
				"username": {S: user},
				"chatID": {S: currChatID}
			}
	      };
	      
	      // create entry for new user in chats table
	      db.putItem(putParams, function(err, data) {
			if (err) {
				console.log("Error", err);
				callback(err, null);
			} else {
				console.log("Success", data);
			}
		  });
		  
		  putParams = {
	  		TableName: "chat_members",
	  		Item: {
				"username": {S: user},
				"chatID": {S: currChatID}
			}
	      };
		  
		  // create entry for new user in chat_members table
	      db.putItem(putParams, function(err, data) {
			if (err) {
				console.log("Error", err)
				callback(err, null);
			} else {
				console.log("Success", data)
			}
		  });
		  
	  	  var inviteParams = {
	  		TableName: "chat_invites",
	  		Item: {
				"invitee": {S: user},
				"sender": {S: sender},
				"chatID": {S: currChatID}
			}
	      };
	      
	      // create entry for chat invite
	      db.putItem(inviteParams, function(err, data) {
			if (err) {
				console.log("Error", err)
			} else {
				console.log("Successful invite creation", data)
			}
		  });
		  
		  
		  callback(err, {chatID: currChatID, messages: null, members: null});
	  }
        

	}
  });
}

var get_chat_notifs = function(user, callback) {
	console.log("GET CHAT notifs: " + user);
	// query chat_members table
    var params = {
        KeyConditionExpression: 'invitee = :user',
        ExpressionAttributeValues: {
            ':user': {'S': user},
        },
        TableName: "chat_invites"
    };
    
    db.query(params, function(err, data) {
		if (err) {
			console.log('error finding user in chat_invites table');
		} else if (data.Items.length != 0) { // notifs exist
			callback(err, {chatNotifs: data.Items});
		} else if (data.Items.length == 0) { // no members in chat
			callback(err, {chatNotifs: []});
		}
	});
};

var get_chat_info = function(currChatID, callback) {
	console.log("GET CHAT INFO: " + currChatID);
	// query chat_members table
    var params = {
        KeyConditionExpression: 'chatID = :chat',
        ExpressionAttributeValues: {
            ':chat': {'S': currChatID},
        },
        TableName: "chat_members"
    };
    
    db.query(params, function(err, data) {
		if (err) {
			console.log('error finding chatID in chat_members table')
		} else if (data.Items.length != 0) { // members exist
			// query messages table
		    var messagesParams = {
		        KeyConditionExpression: 'chatID = :chat',
		        ExpressionAttributeValues: {
		            ':chat': {'S': currChatID},
		        },
		        TableName: "messages"
		    };
		    
		    db.query(messagesParams, function(err, data2) {
				if (err) {
					console.log('error finding chatID in messages table')
				} else if (data2.Items.length != 0) { // messages exist
					// send back messages
					// sort by timestamp first?
					callback(err, {chatID: currChatID, messsages: data2.Items, members: data.Items});
				} else if (data2.Items.length == 0) { // chat was previously created but no messages sent
					callback(err, {chatID: currChatID, messsages: null, members: data.Items});
				}
			});
		} else if (data.Items.length == 0) { // no members in chat
			callback(err, {chatID: currChatID, members: null, messages: null});
		}
	});
};

var send_message = function(chatID, text, sender, callback) {
  var time = (Date.now()).toString();
  console.log("TIME: " + time);
  
  var params = {
	  TableName: 'messages',
	  Item: {
	    'chatID' : {S: chatID},
	    'timestamp' : {N: time},
	    'message' : {S: text},
	    'sender' : {S: sender},
	  },
  };
  
  //put operation
  db.putItem(params, function(err, data) {
  if (err) {
	console.log("error with message put DB side: " + err);
    callback(err, null);
  } else {
	console.log("succeossful message put DB side");
	
	// handle creation of entries in chats and chat_members tables
	// query messages table to see if message is first message ever in chat
	 /* var params = {
            KeyConditionExpression: 'chatID = :chatID',
            ExpressionAttributeValues: {
                ':chatID': {'S': chatID},
            },
            TableName: "messages"
        };
  
	  // query
	  db.query(params, function(err, data) {
		if (err) {
			console.log("error querying messages table: " + err);
		} else if (data.Items.length == 1) { // only contains first message just put
			// put items into chats and chat_members table
		}
	  });*/
	    // callback(err, "success");
	  }
  });
}

//put user but ALLOW DUPLICATE usename --this will be used to update account info
var user_put_allowdup = function(uname, psw, fname, lname, emil, affil, bday, callback) {

  var params = {
  TableName: 'users',
  Item: {
    'username' : {S: uname},
    'password' : {S: psw},
    'firstname' : {S: fname},
    'lastname' : {S: lname},
    'email' : {S: emil},
    'affiliation' : {S: affil},
    'birthday' : {S: bday}
    
  }
  };
  //put operation
  db.putItem(params, function(err, data) {
  if (err) {
    callback(err, null);
  } else {
    callback(err, "success");
  }
  });
  
}

//put user but ALLOW DUPLICATE usename --this will be used to update account info
var newsPref_put = function(uname, pref, callback) {

  let capPref = pref.toUpperCase();
  var params = {
  TableName: 'user_interests',
  Item: {
    'username' : {S: uname},
    'category' : {S: capPref}
  }
  };
  //put operation
  db.putItem(params, function(err, data) {
  if (err) {
    callback(err, null);
  } else {
    callback(err, "success");
  }
  });
}

var newsPref_delete_all = function(uname, callback) {
	console.log('Looking up in newspref: ' + uname); 
  //initialize param
  var params = {
            KeyConditionExpression: 'username = :username',
            ExpressionAttributeValues: {
                ':username': {'S': uname}
            },
            TableName: "user_interests"
        };
  
  //query
  db.query(params, function(err, data) {
    if (err || data.Items.length == 0) {
	  console.log('not found'); 
      callback(err, null);
    } else if (data) {
	  //send user info back
	  console.log('Found');
	  //data.Items[0].category.S is first category returned
	  
	  for (let i = 0; i < data.Items.length; i++){
		//delete each item
		//data.Items[0].username.S will be the partition key, data.Items[0].category.S will be sort key
		console.log("here's username" + data.Items[i].username.S);
		console.log("here's category:" + data.Items[i].category.S);
		var params = {
		  TableName: 'user_interests',
		  Key: {
			username: {
				S: data.Items[i].username.S
			},
			category: {
				S: data.Items[i].category.S
			}
		  }
	  };
	  
	  // delete from chat_members table
		  db.deleteItem(params, function(err, data) {
			  if (err) {
				console.log("error with pref deletion" + err);
			    
			  } else {
				 console.log("delete success");
			}
		  });
	  }
	   
	   callback(null, "success");
     
    }
  });
	
}
var get_suggestions = function(name, callback) {
	var params = {
      TableName: "prefixes",
      KeyConditions: {
        prefix: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ { S: name } ]
        }
      },
  	};
  	
    db.query(params, function(err, data) {
	    if (err) {
		  console.log(err);
		  console.log("Error is with querying " + name);
	      callback(err, null);
	    } else {
	      callback(err, data);
	    }
  	});	
}

var get_comments = function(name, callback) {
	var params = {
      TableName: "comments",
      KeyConditions: {
        postID: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ { S: name } ]
        }
      },
  	};
  	
    db.query(params, function(err, data) {
	    if (err) {
		  console.log(err);
	      callback(err, null);
	    } else {
	      callback(err, data);
	    }
  	});	
}

var get_postee_post = function(name, callback) {
	var params = {
      TableName: "postsByPostee",
      KeyConditions: {
        postee: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ { S: name } ]
        }
      },
  	};
  	
    db.query(params, function(err, data) {
	    if (err) {
		  console.log(err);
	      callback(err, null);
	    } else {
	      callback(err, data);
	    }
  	});	
}

var get_poster_post = function(name, callback) {
	var params = {
      TableName: "postsByPoster",
      KeyConditions: {
        poster: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ { S: name } ]
        }
      },
  	};
  	
    db.query(params, function(err, data) {
	    if (err) {
		  console.log(err);
	      callback(err, null);
	    } else {
	      callback(err, data);
	    }
  	});	
}

var get_friends = function(name, callback) {
	var params = {
      TableName: "friends",
      KeyConditions: {
        username: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ { S: name } ]
        }
      },
  	};
  	
    db.query(params, function(err, data) {
	    if (err) {
		  console.log(err);
	      callback(err, null);
	    } else {
	      callback(err, data);
	    }
  	});	
}

//FRIENDS operation
var put_friend = function(username, friend, callback) {
	
  //ensures that the friend is not already added
  var params = {
   TableName: "friends",
   Item: {
     "username": {S: username},
     "friend": {S: friend}
     
   },
   ConditionExpression: 'attribute_not_exists(username) AND attribute_not_exists(friend)'
}
  
  //put operation
  db.putItem(params, function(err, data) {
  if (err) {
    callback(err, null);
  } else {
    var params = {
	  TableName: 'friends',
	  Item: {
	    'username' : {S: friend},
	    'friend' : {S: username}
	  	},
	  };
	  
	  //put operation
	  db.putItem(params, function(err, data) {
		  if (err) {
		    callback(err, null);
		  } else {
		    callback(err, "successfully added friend");
		  }
	  });
	}
	  
  });
  
  
  
}

/**
searches up a username in the recommendations table, returns the articles

@param searchTerm username to be searched
@param callback callback function articles are retrieved
 */
var get_recommendations = function(searchTerm, callback) {
  var params = {
      KeyConditions: {
        username: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ { S: searchTerm } ]
        }
      },
      TableName: 'recommendations',
  };
  
  db.query(params, function(err, data) {
	let promiseArr = [];
	let articles = [];
	let paramsArr = [];
	for (let item of data.Items) {
		let url = item.url.S;
		var innerParams = {
			KeyConditions: {
				url: {
					ComparisonOperator: 'EQ',
					AttributeValueList: [ { S: url } ]
				}
			},
			TableName: 'articles',
		};
		paramsArr.push(innerParams);
	}
	for (let innerParams of paramsArr) {
		promiseArr.push(db.query(innerParams).promise().then((data) => {
			articles.push(data.Items[0]);
		}));
	}

	Promise.all(promiseArr).then(() => {
		callback(err, articles);;
	}, function(err) {
		console.log(err);
	});
  });
}

/**
adds a username and article to the likes table upon clicking the like button

@param username username of user currently logged in
@param url url of the article
@param callback callback function 
 */
var put_article = function(username, url, callback) {
	var params = {
		Item: {
			"username": {S: username},
			"url": {S: url}
		},
		TableName: "likes",
		ReturnValues: 'NONE'
	};
	
	db.putItem(params, function(err, data) {
		if (err) {
			console.log(err);
		} else {
			console.log("successfully liked article");
			callback();
		}
	});
}

var search_article = function(search, callback) {
	let keywords = search.split(" ");
	
	let freqMap = new Map();
	let paramsArr = [];
	let promiseArr = [];
	
	
	for (let key of keywords) {
		var params = {
			KeyConditions: {
				keyword: {
					ComparisonOperator: 'EQ',
					AttributeValueList: [ { S: key } ]
		        }
	        },
	        TableName: 'inverted_articles',
		};
		paramsArr.push(params);
	}
	
	var populateMap = function(data) {
		for (let item of data.Items) {
			let url = item.url.S;
			if (freqMap.has(url)) {
				freqMap.set(url, freqMap.get(url) + 1);
			} else {
				freqMap.set(url, 1);
			}
		}
	}
	
	for (let params of paramsArr) {
		promiseArr.push(db.query(params).promise().then((data) => {
			populateMap(data);
		}));
	}
	
	let articles = [];
	
	Promise.all(promiseArr).then(() => {
		let paramsArr2 = [];
		let promiseArr2 = [];
		for (let [key, value] of freqMap) {
			var params = {
				KeyConditions: {
					url: {
						ComparisonOperator: 'EQ',
						AttributeValueList: [ { S: key } ]
			        }
		        },
		        TableName: 'articles',
			};
			paramsArr2.push(params);
		}
		
		for (let params of paramsArr2) {
			promiseArr2.push(db.query(params).promise().then((data) => {
				articles.push(data.Items[0]);
			}));
		}
		
		Promise.all(promiseArr2).then(() => {
			let itemMap = new Map();
			for (let article of articles) {
				itemMap.set(article, freqMap.get(article.url.S));
			}
			let sortedMap = new Map([...itemMap.entries()].sort((a, b) => b[1] - a[1]));
			let sortedArticles = [];
			for (let [key, value] of sortedMap) {
				sortedArticles.push(key);
			}
			callback(sortedArticles);
		});
	});
	
}

// TODO Your own functions for accessing the DynamoDB tables should go here

/* We define an object with one field for each method. For instance, below we have
   a 'lookup' field, which is set to the myDB_lookup function. In routes.js, we can
   then invoke db.lookup(...), and that call will be routed to myDB_lookup(...). */

// TODO Don't forget to add any new functions to this class, so app.js can call them. (The name before the colon is the name you'd use for the function in app.js; the name after the colon is the name the method has here, in this file.)

var database = { 
  lookup: user_lookup,
  u_put: user_put,
  inviteChat: invite_chat,
  send_message: send_message,
  u_update: user_put_allowdup,
  newsPref_put: newsPref_put,
  newsPref_delete_all: newsPref_delete_all,
  put_postee: put_postee,
  get_postee_post: get_postee_post,
  put_friend: put_friend,
  friends_lookup: friends_lookup,
  update_active_status: update_active_status,
  get_recommendations: get_recommendations,
  addToChat: add_to_chat,
  getChatInfo: get_chat_info,
  get_friends: get_friends,
  put_poster: put_poster,
  get_poster_post: get_poster_post,
  leaveChat: leave_chat,
  put_article: put_article,
  put_comment: put_comment,
  get_comments: get_comments,
  getChatNotifs: get_chat_notifs,
  deleteChatNotif: delete_notif,
  get_suggestions: get_suggestions,
  put_prefixes: put_prefixes,
  search_article: search_article,
};

module.exports = database;
                                        