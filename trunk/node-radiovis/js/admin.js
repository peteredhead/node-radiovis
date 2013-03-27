var baseTopic;
var vis;
$(function() {
	var allInputs = $("#stationForm :text");
	var vis;
	$.get("/admin/getTopic", function(data) {
		baseTopic = data;
		topicArray = data.split('/');
		var bearer = topicArray[2];
		$("#bearer").val(bearer);
		changeBearer(bearer);
		switch (bearer) {
			case "am":
				if (topicArray[3] == "drm") {
					$("#amType").val("drm");
				} else {
					$("#amType").val("amss");
				}
				$("#amSid").val(topicArray[4]);
				break;
			case "dab":
				$("#dabEcc").val(topicArray[3]);
				$("#dabEid").val(topicArray[4]);
				$("#dabSid").val(topicArray[5]);
				$("#dabScids").val(topicArray[6]);
				if (parseInt(topicArray[7]) > -1 && parseInt(topicArray[7]) < 1024) {
					$("#dabPa").val(topicArray[7]);
				} else {
					$("#dabAppty").val(topicArray[7]);
				}
				break;
			case "fm":
				$("#fmEcc").val(topicArray[3]);
				$("#fmPi").val(topicArray[4]);
				$("#fmFreq").val(parseInt(topicArray[5],10)/100);
				break;
			case "hd":
				$("#hdCc").val(topicArray[3]);
				$("#hdTx").val(topicArray[4]);
				break;
		}

	    var topics = new Array();
	    vis = new VisClient("/comet",[baseTopic+"/image", baseTopic+"/text" ],'',
			function (rsp) {
	        	if(rsp.type == "image") {
		        	$("#viewer ul").html("<li><img src=\"" + rsp.src + "\" width=\"320\" height=\"240\"></li>");
				} else if(rsp.type == "text") {
	            	$("#cometText").text(rsp.msg);
				}
			}
		);
	});

	
	$("#bearer").change(function() {
		var bearer = $("#bearer").val();
		changeBearer(bearer);
		
	});

	$("#setButton").click(function() {
		$("#stationError").hide("fast", function() {
		allInputs.css("background-color","#FFFFFF");
		var bearer = $("#bearer").val();
		var topic;
		switch(bearer) {
		case "am":
			// AM Service /topic/am/{drm|amss}/sid
			var amType = $("#amType").val();
			var amSid = $("#amSid").val(); // sid = 6 char hex

			if (!amSid.match(/^([0-9A-Fa-f]{6})$/)) {stationError("amSid", "Service ID must be a 6 character hexdecimal");}

			topic = "/topic/am/"+amType+"/"+amSid;
			break;
		
		case "dab":
			// DAB Service /topic/dab/ecc/sid/scids[/pa | appty-uatype]                                  
			var dabEcc = $("#dabEcc").val(); // ecc = 3char hex
			var dabEid = $("#dabEid").val(); // eid = 4char hex
			var dabSid = $("#dabSid").val(); // sid = 4 or 8 char hex
			var dabScids = $("#dabScids").val(); // scids = 1 or 3 char hex
			var dabAppty = $("#dabAppty").val(); // appty-uatype = 2 char hex-3char hex
			var dabPa = $("#dabPa").val(); // pa = int 0 > 1023

			if ((dabAppty.length > 0) && (!dabAppty.match(/^([0-9A-Fa-f]{2})-([0-9A-Fa-f]{3})$/))) {stationError("dabAppty", "XPAD Application type and User Application type must be in the format xx-xxx, if specified");}
			if ((dabPa.length > 0) && (!(parseInt(dabPa) > -1 && parseInt(dabPa) < 1024)))  {stationError("dabPa", "The packet address must be between 0 and 1023 if specified");}
			if ((dabAppty.length > 0) && (dabPa.length > 0)) {stationError("dabAppty", "The XPAD Application type and Package address cannot both be specified");}
			if (!dabScids.match(/^([0-9A-Fa-f]{1})$/) && !dabScids.match(/^([0-9A-Fa-f]{3})$/)) {stationError("dabScids", "Service Component ID must be a 1 or 3 character hexdecimal");}
			if (!dabSid.match(/^([0-9A-Fa-f]{4})$/) && !dabSid.match(/^([0-9A-Fa-f]{8})$/)) {stationError("dabSid", "Service ID must be a 4 or 8 character hexdecimal");}
			if (!dabEid.match(/^([0-9A-Fa-f]{4})$/)) {stationError("dabEid", "Ensemble ID must be a 4 character hexdecimal");}
			if (!dabEcc.match(/^([0-9A-Fa-f]{3})$/)) {stationError("dabEcc", "Country Code must be a 3 character hexdecimal");}

			topic = "/topic/dab/"+dabEcc+"/"+dabEid+"/"+dabSid+"/"+dabScids;
			if ((dabAppty.length > 0) || (dabPa.length > 0)) { topic = topic + "/" +dabAppty+dabPa;}
			
			break;

		case "fm":
			// FM /topic/{ecc|country}/pi/freq
			var fmEcc = $("#fmEcc").val(); // ecc = 3char hex || country = 2char string
			var fmPi = $("#fmPi").val(); // pi = 4char hex
			var fmFreq = $("#fmFreq").val(); // freq = 5 digit int

			if (!parseFloat(fmFreq) || (parseFloat(fmFreq)*100)<8750 || (parseFloat(fmFreq)*100)>10800) {stationError("fmFreq", "Invalid frequency specified");}
			if (!fmPi.match(/^([0-9A-Fa-f]{4})$/)) {stationError("fmPi", "PI code must be a 4 character hexdecimal");}
			if (!fmEcc.match(/^([0-9A-Fa-f]{3})$/) && !fmEcc.match(/^([0-9A-Za-z]{2})$/)) {stationError("fmEcc", "Either a three character hexdecimal or two character country code must be specified");}

			topic = "/topic/fm/"+fmEcc+"/"+fmPi+"/"+padFreq(parseFloat(fmFreq)*100);
			
			break;

		case "hd":
			// HD Radio /topic/hd/cc/tx
			var hdTx = $("#hdTx").val(); // tx = 5char hex
			var hdCc = $("#hdCc").val(); // cc = 3char hex

			if (!hdCc.match(/^([0-9A-Fa-f]{3})$/)) {stationError("hdCc", "Country Code must be a 3 character hexdecimal");}
			if (!hdTx.match(/^([0-9A-Fa-f]{5})$/)) {stationError("hdTx", "Transmitter Indentifier must be a 5 character hexdecimal");}

			topic = "/topic/hd/"+hdTx+"/"+hdCc;
			
			break;
		}	

		if ($("#stationError").is(":hidden")) {
			// /admin/setTopic/
			$.get("/admin/setTopic"+topic,  function(data) {
				$("#topic").text("Topic changed to "+data);
				vis.setTopics(data);
			});
			
		}

		});
	});
	
	// Message Lists
	 $('#textList').load('/admin/loadMessages/text', function() {
		 $(".tmessage").editable({onEdit:enableTextUpdate});
	 });
	 $('#imageList').load('/admin/loadMessages/image', function() {
		 $(".imessage").editable({onEdit:enableImageUpdate});
	 });
		$("#textUpdate").click(function() {
		$("#textUpdate").attr('disabled', 'true');
		msgString = listToString("#textList");
		$.get("/admin/updateMessages?type=text&"+msgString);
		
	});
	$("#imageUpdate").click(function() {
		$("#imageUpdate").attr('disabled', 'true');
		msgString = listToString("#imageList");
		$.get("/admin/updateMessages?type=image&"+msgString);
	});
	$("#textUpdate").attr('disabled', 'true');
	$("#imageUpdate").attr('disabled', 'true');
	
	$("#textList").sortable({
		axis: "y",
		cursor: "move",
		update: function() { enableUpdate("#textUpdate"); }
	});
	$("#imageList").sortable({
		axis: "y",
		cursor: "move",
		update: function() { enableUpdate("#imageUpdate"); }
	});

	// Start + Stop
	$.get("/admin/sender/getStatus", function(data) {
			$("#serverStatus").html(data);
		});
	$("#serverStart").click(function() {
		$.get("/admin/sender/start", function(data) {
			$("#serverStatus").html(data);
		});
	});
	$("#serverStop").click(function() {
		$.get("/admin/sender/stop", function(data) {
			$("#serverStatus").html(data);
		});
	});
    
});

function listToString(list) {
	var msgString = '';
	var msgList = $(list).sortable("toArray");
	for (item in msgList) {
		msgString+= 'msg_'+item+'='+escape($('#'+msgList[item]).text())+"&";
	}
	return msgString;
}

function enableUpdate(button) {
	$(button).removeAttr('disabled');	
};

function enableTextUpdate() {
	$("#textUpdate").removeAttr('disabled');	
};

function enableImageUpdate() {
	$("#imageUpdate").removeAttr('disabled');	
};

function changeBearer(bearer) {
	$(".amParameter").hide();
	$(".dabParameter").hide();
	$(".fmParameter").hide();
	$(".hdParameter").hide();
	$("."+bearer+"Parameter").show();
	return
}

function stationError(id, message) {
	$("#stationError").text(message);
	$("#stationError").show("fast");
	$("#"+id).css("background-color","#ffaeae");
	$("#"+id).focus();
	return
}

function padFreq(freq) {
	var n = freq + '';
	while(n.length < 5) {
		n = "0" + n;
	}
	return n;
}
