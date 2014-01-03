var sock = new SockJS("http://54.212.10.20:8000/echo");
var my_channel = null;
var my_id = null;
var sync_timer = null;
var SYNC_PERIOD_MS = 100;

sock.onopen = function() {
    console.log("sock opened!");
};

sock.onmessage = function(e) {
    handleRaw(e.data);
};

sock.onclose = function() {
    my_id = null;
    my_channel = null;
    console.log("sock close");
};

function handleRaw(rawmsg) {
    var recieved_timestamp = (new Date()).getTime();
//    console.log("handleRaw: '" + rawmsg + "'");

    if (rawmsg.startsWith("subscribed:")) {
        on_subscribe(rawmsg.split("subscribed:", 2)[1]);
    } else if (rawmsg.startsWith("connected:")) {
        my_id = parseInt(rawmsg.split("connected:", 2)[1]);
        console.log("my id is: " + my_id);
        request_subscribe("#sync");
    } else {
        handleMessage(recieved_timestamp, rawmsg);
    }
}

function handleMessage(recieved_timestamp, rawmsg) {
    var msg = JSON.parse(rawmsg);
    if (! "cmd" in msg) {
        return;
    }
    var cmd = msg["cmd"];
    if (cmd == "request_time") {
        respond_with_time(recieved_timestamp, msg);
    } else if (cmd == "time_response") {
  //      console.log("time response: " + rawmsg);
        compute_diff(recieved_timestamp, msg);
    } else {
        console.log("unknown message: " + msg);
    }
}

function broadcast(msg) {
    if (my_id != null) {
        return sock.send("broadcast:" + my_channel + ":" + msg);
    }
    return false;
}

function request_subscribe(channel) {
    console.log("subscribing to channel " + channel + "...");
    sock.send("subscribe:" + channel);
}

function on_subscribe(channel) {
    my_channel = channel;
    console.log("subscribed to channel: " + my_channel);
}

function request_time() {
    var request_packet = {
        sender_id: my_id,
        cmd: "request_time",
        time: (new Date()).getTime(),
    };
//    console.log("time_request: " + JSON.stringify(request_packet, undefined, 2));
    broadcast(JSON.stringify(request_packet));
}

function respond_with_time(recieved_timestamp, request) {
    var response_packet = {
        sender_id: my_id,
        cmd: "time_response",
        recieved_timestamp: recieved_timestamp,
        time: (new Date()).getTime(),
        request: request,
    };
//    console.log("time_response: " + JSON.stringify(response_packet, undefined, 2));
    broadcast(JSON.stringify(response_packet));
}

function compute_diff(recieved_timestamp, msg) {
    var time_request_sent = msg['request']['time'];
    var time_request_recieved = msg['recieved_timestamp'];
    var time_response_sent = msg['time'];
    var time_on_network = (recieved_timestamp - time_request_sent - (time_response_sent - time_request_recieved)) / 2;
    var now = (new Date()).getTime();
//    console.log("time on network: " + time_on_network + "ms");
//    console.log("local  time: " + now + "ms");
//    console.log("remote time: " + time_response_sent + time_on_network + "ms");
    console.log(msg['sender_id'] + " time delta: " + (now - (time_response_sent + time_on_network)) + "ms");
}

function start_clock_sync() {
    if (sync_timer != null) {
        console.log("sync timer is already running!");
        return;
    }
    sync_timer = setInterval(function() {
        request_time();
    }, SYNC_PERIOD_MS);
}

function stop_clock_sync() {
    if (sync_timer == null) {
        console.log("sync timer is not running!");
        return;
    }
    clearInterval(sync_timer);
    sync_timer = null;
}
