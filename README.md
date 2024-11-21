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

For development, you can use nodemon (install with `npm install -g nodemon`) which will auto-reload the JS files:

```
nodemon start
```

For running as a server, you can use pm2 (install with `npm install -g pm2`). And then run:

```
pm2 start server.js
pm2 stop server.js
# optionally reload on boot
pm2 save
```

Note, this uses GeNIe's SMILE API for working with Bayesian networks, via an abstraction layer called 'bni'. A Monash academic license (baked into bni) is included in this repository, but occasionally needs to be renewed.