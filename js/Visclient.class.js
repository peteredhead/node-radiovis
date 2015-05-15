function VisClient(path, topics, lastid, callback) {
    
    this.path = path;
    this.topics = topics;
    this.callback = callback;
    
    this.setTopics = function (baseTopic) {
    	this.topics = [baseTopic+'/text', baseTopic+'/image'];
    };
    
    this.request = function (lastid) {     
        this.lastid = lastid;
        var me = this;
        var xhr = $.ajax({
            type: "GET",
            url: this.path,
            data: { topic: this.topics , last_id:this.lastid},
            success: function (data, textStatus) { me.respond(xhr.getResponseHeader('RadioVIS-Message-ID'), data, textStatus); },
            error: function () { setTimeout(function () { me.request(); }, 10000); }
        });
        
    };
    
    this.respond = function (lastid, data, textStatus) {
        
        if(data.match("^SHOW")) {
            
            var args = data.match("^SHOW (.+)");
            if(!args) { return false; }
            
            this.callback({
                type: "image",
                src: args[1],
                href: args[3] ? args[3] : "#"
            });
            
        } else if(data.match("^TEXT")) {
            
            var args = data.match("^TEXT (.+)");
            if(!args) { return false; }
            
            this.callback({
                type: "text",
                msg: args[1]
            });
            
        }
        var self = this;
        setTimeout(function() {self.request(lastid);}, 1000);
        
    };
    var self = this;
    setTimeout(function() {self.request('');}, 1000);
    
}