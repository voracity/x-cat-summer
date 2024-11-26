# X-CAT Bayes Network viewer

An adaptation of the original CAT https://github.com/voracity/CAT.git to show new visualisations to highlight changes and their importance in the network.

## Installation

To get setup with X-CAT, clone this repository and then run this from the base directory:

```
npm install
node db_setup.js
```

## Usage

Just run:

```
npm start
```

Then visit `http://localhost:3000` to see if things are working.

For development, you can use nodemon (install with `npm install -g nodemon`) which will auto-reload the JS files:

```
nodemon start
```

For running as a server, you can use pm2 (install with `npm install -g pm2`). And then run:

```
pm2 start server.js
pm2 stop server.js
# Optionally, you can autostart on boot with this after starting the server:
pm2 save
```

Note, this uses GeNIe's SMILE API for working with Bayesian networks, via an abstraction layer called 'bni'.
A Monash academic license (baked into bni) is included in this repository, but occasionally needs to be renewed
(this license is 2 years, and should cover the summer project period).