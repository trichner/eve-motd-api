'use strict';
const getBBMotd = require('./bb-motd');

const config = require('./config.json');

getBBMotd(config)
// fetch the motd and parse it
	.then((motd) => {
		console.log(motd);
	})
	.catch((err) => {
		console.log(err);
	});

