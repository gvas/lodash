/* npm */
var chalk = require('chalk');
var request = require('request').defaults({jar:false});
var split = require('split');

/* core */
var util = require('util');
var os = require('os');
var path = require('path');
var proc = require('child_process');
var EventEmitter = require('events').EventEmitter;
var binaries = {
  'darwin': 'sc',
  'linux': 'sc',
  'linux32': 'sc',
  'win32': 'sc.exe'
};

module.exports = SauceTunnel;

function SauceTunnel(user, key, identifier, tunneled, extraFlags) {
  EventEmitter.call(this);
  this.user = user;
  this.key = key;
  this.identifier = identifier || 'Tunnel'+new Date().getTime();
  this.tunneled = (tunneled == null) ? true : tunneled;
  this.baseUrl = ["https://", this.user, ':', this.key, '@saucelabs.com', '/rest/v1/', this.user].join("");
  this.extraFlags = extraFlags;
  this.id = null;
}

util.inherits(SauceTunnel, EventEmitter);

SauceTunnel.prototype.openTunnel = function(callback) {
  var me = this;
  // win32, darwin or linux
  var platform = os.platform();

  // Special case: 32bit linux?
  platform += (platform === 'linux' && os.arch() === 'ia32') ? '32' : '';

  var executable = binaries[platform];
  if (!executable) {
    throw new Error(platform + ' platform is not supported');
  }
  var args = ['-u', this.user, '-k', this.key];
  if (this.identifier) {
    args.push("-i", this.identifier);
  }
  if (this.extraFlags) {
    args = args.concat(this.extraFlags);
  }
  var cmd = path.join(__dirname, 'vendor', platform, 'bin/', executable);

  this.proc = proc.spawn(cmd, args);
  callback.called = false;

  this.proc.stdout.pipe(split()).on('data', function(data) {
    console.log("stdout: " + data);
    if (!data.match(/^\[-u,/g)) {
      me.emit('verbose:debug', data);
    }
    if (data.match(/Sauce Connect is up, you may start your tests/)) {
      me.emit('verbose:ok', '=> Sauce Labs Tunnel established');
      if (!callback.called) {
        callback.called = true;
        callback(true);
      }
    }
    var match = data.match(/Tunnel ID\: ([a-z0-9]{32})/);
    if (match) {
      me.id = match[1];
    }
  });

  this.proc.stderr.pipe(split()).on('data', function (data) {
    console.log("stderr: " + data);
    me.emit('log:error', data);
  });

  var self = this;
  this.proc.on('exit', function(code) {
    me.emit('verbose:ok', 'Sauce Labs Tunnel disconnected ', code);
    if (!callback.called) {
      callback.called = true;
      callback(false);
    }
  });
};

SauceTunnel.prototype.getTunnels = function(callback) {
  request({
    url: this.baseUrl + '/tunnels',
    json: true
  }, function(err, resp, body) {
    callback(body);
  });
};

SauceTunnel.prototype.killTunnel = function(callback) {
  console.log("SauceTunnel 4");
  if (!this.tunneled) {
    return callback();
  }

  console.log("SauceTunnel 5");
  this.emit('verbose:debug', 'Trying to kill tunnel');
  request({
    method: "DELETE",
    url: this.baseUrl + "/tunnels/" + this.id,
    json: true
  }, function (err, resp, body) {
    console.log("Sauce Tunnel 5.2");
    console.log("SauceTunnel 6," + err + "," + resp);
    if (!err && resp.statusCode === 200) {
      this.emit('verbose:debug', 'Tunnel Closed');
    }
    else {
      this.emit('log:error', 'Error closing tunnel');
    }
    console.log("SauceTunnel 7");
    callback(err);
    console.log("SauceTunnel 8");
  }.bind(this));
};

SauceTunnel.prototype.start = function(callback) {
  var me = this;
  if (!this.tunneled) {
    return callback(true);
  }
  this.emit('verbose:writeln', chalk.inverse("=> Sauce Labs trying to open tunnel"));
  this.openTunnel(function(status) {
    callback(status);
  });
};

SauceTunnel.prototype.stop = function (callback) {
  console.log("SauceTunnel 1");
  this.killTunnel(function(err) {
    console.log("SauceTunnel 2");
    this.kill(callback.bind(this, err));
    console.log("SauceTunnel 3");
  }.bind(this));
};

SauceTunnel.prototype.kill = function(callback) {
  console.log("SauceTunnel 9");
  if (this.proc) {
      this.proc.on('exit', function () {
        console.log("SauceTunnel 10");
        callback();
        console.log("SauceTunnel 11");
      });
      console.log("SauceTunnel 12");
      this.proc.kill();
      console.log("SauceTunnel 13");
    }
    else {
      console.log("SauceTunnel 14");
      callback();
      console.log("SauceTunnel 15");
    }
    console.log("SauceTunnel 16");
  };
