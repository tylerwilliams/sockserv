var UPDATE_PERIOD_MS = 10;

function Clock(div_id) {
    this.canvas = Raphael(div_id, 200, 200);
    this.timer = null;
    this.current_time_ms = 0;

    this.update = function() {
        var deciseconds = (this.current_time_ms * 6 / 100) % 60;
        var seconds = this.current_time_ms / 1000 % 60;
        var minutes = (this.current_time_ms / (1000 * 60)) % 60;
        var hours = (this.current_time_ms / (1000 * 60 * 60)) % 12;
        var time_string = hours.toFixed(0) + ":" + minutes.toFixed(0);
        time_string += ":" + seconds.toFixed(0) + ":" + deciseconds.toFixed(0);
        time_text.attr({text: time_string});
        hour_hand.transform("R" + 30*hours+(minutes/2.5) + ",100,100");
        minute_hand.transform("R" + 6*minutes + ",100,100");
        second_hand.transform("R" + (6*seconds).toFixed(1) + ",100,100");
        decisecond_hand.transform("R" + (6*deciseconds).toFixed(1) + ",100,100");
    }

    this.start = function() {
        var self = this;
        this.timer = setInterval(function() {
          self.current_time_ms += UPDATE_PERIOD_MS;
          self.update();
        }, UPDATE_PERIOD_MS);
    }

    this.stop = function() {
        clearInterval(this.timer);
        this.timer = null;
    }

    this.draw = function() {
        var clock = this.canvas.circle(100, 100, 95);
        clock.attr({"fill":"#f5f5f5","stroke":"#444444","stroke-width":"5"})  
        var hour_sign;

        // draw ticks
        for(i = 0; i < 12; i++){
            var start_x = 100+Math.round(80*Math.cos(30*i*Math.PI/180));
            var start_y = 100+Math.round(80*Math.sin(30*i*Math.PI/180));
            var end_x = 100+Math.round(90*Math.cos(30*i*Math.PI/180));
            var end_y = 100+Math.round(90*Math.sin(30*i*Math.PI/180));    
            hour_sign = this.canvas.path("M"+start_x+" "+start_y+"L"+end_x+" "+end_y);
        }

        // draw hands
        hour_hand = this.canvas.path("M100 100L100 50");
        hour_hand.attr({stroke: "#444444", "stroke-width": 6});
        minute_hand = this.canvas.path("M100 100L100 40");
        minute_hand.attr({stroke: "#444444", "stroke-width": 4});
        second_hand = this.canvas.path("M100 110L100 25");
        second_hand.attr({stroke: "#C0362C", "stroke-width": 2});
        decisecond_hand = this.canvas.path("M100 110L100 15");
        decisecond_hand.attr({stroke: "#4169e1", "stroke-width": 1});

        time_text = this.canvas.text(100, 140, "00:00:00:00");
        time_text.attr({'font-size': 15, 'font-family': 'Gothic'});
        time_text.attr("fill", "#000000");
        var pin = this.canvas.circle(100, 100, 5);
        pin.attr("fill", "#000000");    
    }
}







