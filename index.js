// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// start insert
const config = require(`./config`);
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const gzip = require('compression');
const helmet = require('helmet');
const fileUploader = require('express-fileupload');
const bearerToken = require('express-bearer-token');
const i18n = require('./i18n');
const cors = require('./cors.js');
const log = require('logflake')('app');
const jwt = require('./functions/jwt/');


// end insert

const app = require('./app');
const {logger, initLogCorrelation} = require('./utils/logging');
const {fetchProjectId} = require('./utils/metadata');

/**
 * Initialize app and start Express server
 */
const main = async () => {
  let project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    try {
      project = await fetchProjectId();
    } catch (err) {
      logger.warn('Could not fetch Project Id for tracing.');
    }
  }
  // Initialize request-based logger with project Id
  initLogCorrelation(project);

	/** database & crons */

	require('./database/');
	require('./cronjobs');

	/** app && /status **/

	const app = express();
	const routes = require('./endpoints/routes.js');

	await jwt.registerRSA();
	cors.guard(app);

	app.use(helmet());
	app.use(bearerToken());
	app.use(i18n.middleware);
	app.use(gzip());
	app.use(bodyParser.json({ limit: '50mb' }));
	app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
	app.use(cookieParser(config.secret));
	app.use(fileUploader({ createParentPath: true }));
	app.use(config.base, routes);

	/** init **/

	if (config.stage === 'test') {
		module.exports = app;
	} else {
		app.listen(config.port, () => {
			const stage = config.stage || 'development';

			log('info', `Server is running with stage "${stage}" on port ${config.port }\nEnv: ${config.envPath}`);
		});
	}
};

/**
 * Listen for termination signal
 */
process.on('SIGTERM', () => {
  // Clean up resources on shutdown
  logger.info('Caught SIGTERM.');
  logger.flush();
});

main();
