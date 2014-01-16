if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.slice(0, str.length) == str;
  };
}

if (typeof String.prototype.endsWith != 'function') {
  String.prototype.endsWith = function (str){
    return this.slice(-str.length) == str;
  };
}

if (typeof String.prototype.splitFirst != 'function') {
  String.prototype.splitFirst = function (str){
    return [this.substring(0, this.indexOf(str)), this.substring(this.indexOf(str) + 1)];
  };
}

function median(values) {
    values.sort( function(a,b) {return a - b;} );
    var half = Math.floor(values.length/2);
    if (values.length % 2) {
        return values[half];
    } else {
        return (values[half-1] + values[half]) / 2.0;
    }
}

// Hookup some cheap-o logging
if (typeof console != "undefined") 
    if (typeof console.log != 'undefined')
        console.olog = console.log;
    else
        console.olog = function() {};

console.log = function(message) {
    console.olog(message);
    $('#log').append(message + '<br/>');
    $("#log").animate({ scrollTop: $("#log")[0].scrollHeight}, 0);
};
console.error = console.debug = console.info = console.log

