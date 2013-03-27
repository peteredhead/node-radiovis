/**
 * node-radiovis
 * 
 * A demonstration of a self-contained RadioVIS system,
 * implemented in node.js
 * 
 * Copyright 2010-2013 Global Radio 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. 
 * You may obtain a copy of the License at 
 * 
 * http://www.apache.org/licenses/LICENSE-2.0 
 * 
 * Unless required by applicable law or agreed to in writing, software 
 * distributed under the License is distributed on an "AS IS" BASIS, 
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
 * See the License for the specific language governing permissions and 
 * limitations under the License. 
*/

// Application Configuration
var restrict_admin = true, // Restricts access to the admin console to localhost only
    port = 80,              // Port the web server (vis-http and admin interface) runs on
    stomp_port = 61613;     // Port STOMP server runs on
    
var util = require('util'),
	net = require('net'),
	http = require("http"),
	url = require("url"),
	fs = require('fs'),
	sender = require('./sender.js');
	stomp = require('./stomp.js'),
	comet = require('./comet.js');

var cometPath = "/comet",
	adminPath = "/admin",
	slidesPath = "/slides",
	demoPath = "/demo",
	jsPath = "/js";

textFile = 'text.txt';
imageFile = 'slides.txt';
topicFile = 'topic.txt';

var stompServer = stomp.Server(stomp_port);
cometQueueHandler = new comet.QueueHandler();
cometMessageCache = new comet.MessageCache();
stompQueueHandler = new stomp.QueueHandler();
stompMessageCache = new stomp.MessageCache();

// Load any previously set topic base from file
try {
    baseTopic = fs.readFileSync(topicFile, 'utf8');
} catch (err) {
	util.error(err);
	util.log("Unable to load "+topicFile);
	util.log("Setting topic base to /topic/fm/ce1/cc86/09630");
	baseTopic = "/topic/fm/ce1/cc86/09630";
}

// Start the sender
var textSender = new sender.Sender(textFile,baseTopic+'/text');
var imgSender = new sender.Sender(imageFile,baseTopic+'/image');
textSender.reload();
setTimeout(imgSender.reload(),1000);

try {
	http.createServer(function(request, response) {
		var path = url.parse(request.url, true).pathname;
		if (path.indexOf(cometPath) == 0) {
			// Process request
			try {
				var topics = url.parse(request.url, true).query['topic'];
			}
			catch (err) {
				send_error(500, "Error: " +err);
				return;
			}
			if (!topics) {
				send_error(500, "Invalid topic specified");
				return;
			}
    
			var last_id = url.parse(request.url, true).query['last_id'];
			if (last_id !== undefined) {
				if (!isArray(topics)) {
					var last_id_in_cache = cometMessageCache.get_latest_id(topics);
					if (!last_id_in_cache) {
						cometQueueHandler.add_client(response, topics);
					} else {
						if (last_id == last_id_in_cache) {
							cometQueueHandler.add_client(response, topics);
						} else {
							var msg = cometMessageCache.get_from_cache(topics);
							cometQueueHandler.send_message(response, msg['id'], topics, msg['body']);
						}
					}
				} else {
					// Multiple topics
					var topicList = topics;
					var most_recent_topic = '',
					most_recent_id = 0,
					most_recent_time = 0;
    		
					for (var i = 0; i < topicList.length; i++) {
						if (cometMessageCache.is_topic_in_cache(topicList[i])) {
							var topic_latest_time = cometMessageCache.get_latest_time(topicList[i]);
							if (most_recent_time < topic_latest_time) {
								most_recent_time = topic_latest_time;
								most_recent_topic = topicList[i];
								most_recent_id = cometMessageCache.get_latest_id(topicList[i]);
							}
						}
					}
					if (last_id == most_recent_id || most_recent_topic == '') {
						cometQueueHandler.process_request(response, topicList);
					} else {
						var msg = cometMessageCache.get_from_cache(most_recent_topic);
						cometQueueHandler.send_message(response, msg["id"], most_recent_topic, msg["body"]);
					}
				}
			} else {
				var topic;
				if (!isArray(topics)) {
		    		topic = topics;
		    	} else {
		    		topic = topics[0];
		    	}
				    	
				if (cometMessageCache.is_topic_in_cache(topic)) {
					var msg = cometMessageCache.get_from_cache(topic);
					cometQueueHandler.send_message(response, msg["id"], topic, msg["body"]);
				} else {
					cometQueueHandler.process_request(response, topics);
				}
			}
    
		} else if (path.indexOf(slidesPath) == 0 || path.indexOf(demoPath) == 0 || path.indexOf(jsPath) == 0) {
			serve_file(path, request, response);
		} else if (path.indexOf(adminPath) == 0) {
			if (restrict_admin && request.client.remoteAddress != "127.0.0.1") {
				send_error(response, 403, 'Administration is restricted to local access only');
			}
			if (path.indexOf('/admin/loadMessages/')==0) {
				var msgFile;
				var msgLiId;
				var msgClass;
				try {
					if (path.indexOf('text')>0) {
						msgFile = textFile;
						msgLiId = 'textItem';
						msgClass = 'tmessage';
					} else if (path.indexOf('image')>0) {
						msgFile = imageFile;
						msgLiId = 'imageItem';
						msgClass = 'imessage';
					} else {
						send_error(response, 403, 'File not found');
					}
				} catch(err) {
					send_error(response, 500, 'Server Error');
				}
				
				fs.readFile(msgFile, function(err, data) {
					if (err) {
						util.error(err);
					}
					data = String(data);
					data_array = data.split("\n");
					var returns='';
					for (i=0;i<data_array.length;i++) {
						if (data_array[i].length>1) {
							returns = returns + '<li id="'+msgLiId+'-'+(i+1)+'"><div class="'+msgClass+'">'+data_array[i].substring(5)+'</div></li>'+"\n";
						}
					}
					response.writeHead(200);  
		      		response.write(returns);  
		      		response.end();
				});
				return
			}
			if (path.indexOf('/admin/getTopic') == 0) {
				response.writeHead(200);
				response.write(baseTopic);
				response.end();
				return
			}
			if (path.indexOf('/admin/setTopic') == 0) {
				var newTopic = path.substr(15);
				if (newTopic.indexOf('/topic')!=0) {
					send_error(response, 500, 'Invalid topic');
					return
				}
				util.log('Changing topic to '+newTopic);
			
			
				fs.writeFile(topicFile, newTopic, function(err) {
				    if(err) {
				        util.error(err);
				    } 
				}); 		
				textSender.changeTopic(newTopic+'/text');
				imgSender.changeTopic(newTopic+'/image');
				response.writeHead(200);
				response.write(newTopic);
				response.end();
				
				cometQueueHandler.process_queue(baseTopic+'/text', 0, 'DISCONNECT');
				cometQueueHandler.process_queue(baseTopic+'/image', 0, 'DISCONNECT');
				baseTopic = newTopic;
				return
			}
			
			if (path.indexOf("/admin/sender/") == 0) {
				status = path.substring(14);
				textSender.setRunning(status);
				var runningStatus = imgSender.setRunning(status);
				
				response.writeHead(200);
				if (runningStatus) {
					response.write('running');
				} else {
					response.write('stopped');
				}
				response.end();
				return;
			}
			
			if (path.indexOf("/admin/updateMessages")==0) {
				try {
					var type = url.parse(request.url, true).query['type'];
					var msg0 = url.parse(request.url, true).query['msg_0'] || '';
					var msg1 = url.parse(request.url, true).query['msg_1'] || '';
					var msg2 = url.parse(request.url, true).query['msg_2'] || '';
					var msg3 = url.parse(request.url, true).query['msg_3'] || '';
					var prefix;
					if (type == 'text') {
						filename = textFile;
						prefix = 'TEXT ';
					} else if (type == 'image') {
						filename = imageFile;
						prefix = 'SHOW ';
					} else {
						send_error(reponse, 500, 'Invalid type');
						return
					}
					response.end();
					var fileData=prefix+msg0+"\n"+prefix+msg1+"\n"+prefix+msg2+"\n"+prefix+msg3+"\n";
					fs.writeFile(filename, fileData, function(err) {
					    if(err) {
					        util.error(err);
					    } 
					}); 					
					return
				}
				catch (err) {
					util.erorr(err);
					send_error(response, 500, "Error: " +err);
					return;
				}	
			}	
			serve_file(path, request, response);
			
		} else {
			response.writeHead(404);
			response.write("Requested URL not found");
			response.end();
		}
	}).listen(port);
} catch (err) {
	if (err == "Error: EADDRINUSE, Address already in use") {
		util.erorr(err);
		process.exit(code=0);
	} else {
		util.error(err);
	}
}	

util.log('Server started on port '+port);

function serve_file(path, request, callback) {
	if (path.indexOf('..') >= 0) {
		send_error(404, "Requested URL not found");
		return
	}
	if (path.indexOf('/',1)<0) {
		path = path + '/index.html';
	}
	
	fs.stat('.'+path, function (err, stats) {
		if (err) {
			util.error(err);
			send_error(callback, 404, "Requested URL not found");
			return
		}
    
		var size = stats['size'];
		var modified = stats['mtime'];
		if (Date.parse(request.headers['if-modified-since']) >= Date.parse(modified)) {
			callback.writeHead('304', {'Last-Modified':modified.toUTCString()});
			callback.end();  
			return
		}
		
		fs.readFile('.'+path, function (err, data) {
			if (err) {
				send_error(callback, 404, "Requested URL not found");
				return
			}
      		var ext = path.split('.')[-1];
      		var mime;
      		switch (ext) {
      			case "html":
      				mime = "text/html";
      				break;
      			case "htm":
      				mime = "text/html";
      				break;
      			case "js":
      				mime = "application/javascript";
      				break;
      			case "jpg":
      				mime = "image/jpeg";
      				break;
      			case "jpeg":
      				mime = "image/jpeg";
      				break;
      			case "png":
      				mime = "image/png";
      				break;
      			case "css":
      				mime = "text/css";
      				break;
      			default:
      				mime = "text/plain";
      		}
      		callback.writeHead(200, {'Content-Length':size,'Last-Modified':modified.toUTCString()});  
      		callback.write(data, "binary");  
      		callback.end();  
		});
	});
}

function send_error(callback, code, message) {
	callback.writeHead(code);
	callback.write(message);
	callback.end();
}

function isArray(obj) {
	   return (!(obj.constructor.toString().indexOf("Array") == -1));
}
