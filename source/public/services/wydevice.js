
"use strict";

var angular = require ('angular');

var EventEmitter = require ('events').EventEmitter;

var settings = require ('settings');
require ('debug').enable (settings.debug);
var debug = require ('debug')('wyliodrin:lacy:wydevice');

var compare_versions = require ('compare-versions');

var uuid = require ('uuid');

var _ = require ('lodash');

debug ('Loading');

module.exports = function ()
{

	var app = angular.module ('wyliodrinApp');

	app.factory ('$wydevice', function ($http)
	{
		debug ('Registering');
		var device = null;

		var WyliodrinDevice = null;
		var Devices = null;
		// var service = null;
		var devices = {};

		var status = 'DISCONNECTED';

		chrome.runtime.getBackgroundPage(function (backgroundPage) {
		    WyliodrinDevice = backgroundPage.WyliodrinDevice;
		    Devices = backgroundPage.Devices;
		});

		var deviceService = {
			connect: function (strdevice, options)
			{
				console.log('wydevice connect');
				console.log(strdevice);
				console.log(options);
				if (!WyliodrinDevice) throw ('Wyliodrin device not initialised');
				if (device && device.status !== 'DISCONNECTED') device.disconnect();
				debug (options);
				var categoryhint = (options?options.category:undefined);
				var platformhint = (options?options.platform:undefined);
				console.log (categoryhint);
				console.log (platformhint);
				device = new WyliodrinDevice (strdevice, options);
				devices[strdevice] = device;
				var that = this;
				
				
				device.on ('connection_login_failed', function ()
							{
								if (device) that.emit ('connection_login_failed', strdevice);
							});

				device.on ('connection_error', function ()
							{
								if (device) that.emit ('connection_error', strdevice);
							});

				device.on ('connection_timeout', function ()
							{
								if (device) that.emit ('connection_timeout', strdevice);
							});
				
				device.on ('status', function (_status)
				{
					status = _status;
					if (status !== 'CONNECTED') deviceService.device = 
					{
						category: categoryhint || 'board',
						platform: platformhint || 'linux',
						network: false
					};
					if (status === 'ERROR' || status === 'DISCONNECTED')
					{
						device.removeAllListeners ();
						device = null;
					}
					that.emit ('status', _status, strdevice);
				});

				device.on ('message', function (t, d)
				{
					if (t === 'i')
					{
						// console.log (d);
						if (!deviceService.device) deviceService.device = {};
						deviceService.device.name = d.n;
						deviceService.device.category = d.c;
						deviceService.device.network = d.i;
						deviceService.device.platform = d.p || 'linux';
						that.emit ('status', status, strdevice);
					}
					else
					if (t === 'capabilities')
					{
						debug (d);
						deviceService.device.capabilities = d;
					}
					else
					if ((t === 'v' || t === 'sv') && !d.s)
					{
						if (deviceService.device)
						{
							deviceService.device.version = d.v;
						}
						$http.get('https://cdn.rawgit.com/Wyliodrin/wyliodrin-app-server/master/package.json?'+uuid.v4())
					       .then(function(res){
						       	try
						       	{
						        	var version = res.data.version;
						        	debug ('Version '+version);
						        	debug (compare_versions(d.v, version));
						        	if (compare_versions(d.v, version) < 0) that.emit ('update');
						        }
						        catch (e)
						        {
						        	debug ('Version error');
						        	debug (e);
						        }
					    	});
					}
					that.emit ('message', t, d);
				});
			},

			getStatus: function ()
			{
				return status;
			},

			send: function (tag, data)
			{
				if (device)
				{
					device.send (tag, data);
				}
			},

			listSerialDevices: function (done)
			{
				if (WyliodrinDevice)
				{
					WyliodrinDevice.listDevices ("serial", function (err, list)
					{
						done (err, list);
					});
				}
				else
				{
					done (new Error ('Wyliodrin device not initialised'));
				}
			},

			registerForNetworkDevices: function (done)
			{
				if (Devices)
				{
					Devices.registerListener (done);
				}
			},

			unregisterForNetworkDevices: function (done)
			{
				if (Devices)
				{
					Devices.unregisterListener (done);
				}
			},

			disconnect: function (deviceId)
			{
				if (devices[deviceId])
				{
					devices[deviceId].disconnect ();
				}
			}
		};

		deviceService = _.assign (new EventEmitter(), deviceService);

		return deviceService;
	});
};
