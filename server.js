'use strict';

const restify = require('restify');
const logger = require('restify-logger');

const getMotd = require('./bb-motd');
const config = require('./config.json');

const PORT = 3000;

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
			console.log('Updated MOTD');
			self.motd = motd;
		})
}, 30000);

//-- provide REST API
const server = restify.createServer();

server.use(logger('custom'));

server.use(restify.CORS());

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

server.listen(PORT, function () {
	console.log('%s listening at %s', server.name, server.url);
});
