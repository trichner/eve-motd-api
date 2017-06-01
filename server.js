'use strict';

const restify = require('restify');

const getMotd = require('./bb-motd');
const config = require('./config.json');

//-- fetch MOTD from time to time
const self = this;

// shared MOTD object ( is this safe? )
let motd = null;
getMotd(config)
	.then(motd => {
		self.motd = motd;
	});

setInterval(() => {
	getMotd(config)
		.then(motd => {
			self.motd = motd;
		})
}, 30000);

//-- provide REST API
const server = restify.createServer();
server.get('/motd/upcoming-fleets', (req, res, next) => {
	if (!self.motd) {
		res.send(503);
		return next();
	}
	res.json(self.motd.upcomingFleets);
	return next();
});

server.get('/motd/kills', (req, res, next) => {
	if (!self.motd) {
		res.send(503);
		return next();
	}
	res.json(self.motd.sortedKills);
	return next();
});

server.get('/motd/text', (req, res, next) => {
	if (!self.motd) {
		res.send(503);
		return next();
	}
	res.json(self.motd.text);
	return next();
});

server.listen(8080, function () {
	console.log('%s listening at %s', server.name, server.url);
});