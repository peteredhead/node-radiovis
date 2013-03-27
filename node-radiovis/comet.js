function QueueHandler() {
	queue = new Array();
}

QueueHandler.prototype.process_request = function (callback, topics) {
	if (topics.constructor == Array) {
		for (var i = 0; i < topics.length; i++) {
			this.add_client(callback, topics[i]);
		}
	} else {
		this.add_client(callback, topics);
	}
	return
};

QueueHandler.prototype.add_client = function (callback, topic) {
	if (queue[topic] === undefined) {
		var callbacks = new Array(callback);
		queue[topic] = callbacks;
	} else {
		queue[topic].push(callback);
	}
	cometMessageCache.create_topic(topic);
	return
};

QueueHandler.prototype.process_queue = function (topic, message_id, message) {
	if (queue[topic] == undefined) {
		queue[topic] = new Array();
	}
	cometMessageCache.update_message(topic, message_id, message);
	while (queue[topic].length > 0) {
		callback = queue[topic].shift();
		this.send_message(callback, message_id, topic, message);
	}
	queue[topic] = new Array();
	return
};

QueueHandler.prototype.send_message = function (callback, message_id, topic, message) {
	try {
		callback.writeHead(200, {
		    'RadioVIS-Message-ID':message_id,
		    'RadioVIS-Destination':topic,
		    'RadioVIS-Trigger-Time':'NOW',
		    'Cache-Control':'no-store, no-cache, must-revalidate',
		    'Pragma':'no-cache'});
		callback.write(message);
		callback.end();
	} catch (err) {
		return
	}
}

function MessageCache() {
	store = new Array();
}

MessageCache.prototype.create_topic = function(topic) {
	if (store[topic] === undefined) {
		store[topic] = new Array();
	}
	return
};

MessageCache.prototype.is_topic_in_cache = function (topic) {
	return (topic in store); 
};

MessageCache.prototype.get_latest_time = function (topic) {
	if (this.is_topic_in_cache(topic)) {
		return store[topic]['timestamp'];
	} else {
		return false;
	}
};    

MessageCache.prototype.get_latest_id = function (topic) {
	if (this.is_topic_in_cache(topic)) {
		return store[topic]['id'];
	} else {
		return false;
	}
};

MessageCache.prototype.get_from_cache = function (topic) {
	if (this.is_topic_in_cache(topic)) {
		return store[topic];
	} else {
		return false;
	}
};

MessageCache.prototype.update_message = function (topic, id, body) {
	if (!this.is_topic_in_cache(topic)) {
		store[topic] = new Array();
	}
	store[topic]['body'] = body;
	store[topic]['id'] = id;
	store[topic]['timestamp'] = new Date().getTime();
	return
};

exports.QueueHandler = QueueHandler;
exports.MessageCache = MessageCache;