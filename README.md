<p align="center">
  <a href="https://mml.io">
    <img src="./branding/src/svg/animation/mml-logotype-animation-black.svg" height="128">
    <h1 align="center">MML: Metaverse Markup Language</h1>
  </a>
</p>

[![main github actions](https://github.com/mml-io/mml/actions/workflows/main.yaml/badge.svg)](https://github.com/mml-io/mml/actions/workflows/main.yaml)
[![npm version](https://img.shields.io/npm/v/@mml-io/mml-web.svg?style=flat)](https://www.npmjs.com/package/@mml-io/mml-web)
![GitHub top language](https://img.shields.io/github/languages/top/mml-io/mml)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/mml-io/mml/blob/main/LICENSE)

MML is a markup language for describing 3D multi-user interactive Metaversal objects and experiences based on HTML.

## Getting Started

* Visit https://mml.io/ to get started with MML.
* Check out https://github.com/mml-io/mml-starter-project to get started running an MML document for yourself.
* Check out https://github.com/mml-io/mml-playground to find an example of a 3D web experience that can include MML documents.

## What is MML?

The "MML stack" is a combination of two main pieces usually combined together:
* **MML (Language)** - 3D HTML elements and attributes for describing 3D objects and experiences
* **Networked DOM (Networking)** - A library and network protocol for running MML/HTML documents on a server so that multiple users can interact with them in a multi-user mode.

### MML (Language)

E.g.
```html
<m-cube id="my-cube" color="red"></m-cube>
<script>
  const cube = document.getElementById('my-cube');
  cube.addEventListener('click', () => {
    cube.setAttribute('color', 'blue');
  });
</script>
```

HTML and JavaScript in the form of the DOM (Document Object Model) provide an existing foundation for describing and mutating a hierarchy of elements. MML uses this foundation with new elements and attributes to allow describing 3D concepts.

### Network Model

In the common use case an MML document is run on a server and is observed and interacted with by multiple users.

This capability is achieved by running an MML Document on a server using a library (built expressly for MML) called "Networked DOM".

The server and network components necessary to support this multi-user mode are independent of the MML additions to HTML (and can be used with regular 2D HTML).

### Combined

The Networked DOM server and MML client can then be used to allow multiple users to interact with the same instance of an object at the same time, and bring these objects into game engines and web virtual world experiences.

## Benefits

* **Familiarity**: MML is based on HTML, the most common way to author documents for the web. This makes it approachable for a wide range of creators.
* **Ecosystem**: the HTML ecosystem is vast, and because MML is based on HTML, creators can take advantage of this existing ecosystem of libraries, frameworks, and learning resources.
* **Portability**: MML documents can run in any modern web browser, making them easy to share and view.
* **Composability**: MML documents can be composed of multiple documents running on different servers, making it possible to create complex virtual world objects without having to provide all the compute power and technical capability on a single server.

# Packages

## Language (MML)
MML is a set of HTML elements and attributes that can be used to describe 3D objects and experiences. The schema for these elements and attributes is defined in XML Schema Definition Language (XSD).

* [./packages/schema](./packages/schema) - `@mml-io/schema` - MML Schema in XML Schema Definition Language (XSD)
* [./packages/schema-validator](./packages/schema-validator) - `@mml-io/schema-validator` - A package for validating MML document using the MML Schema
* [./packages/mml-react-types](./packages/mml-react-types) - `@mml-io/mml-react-types` - TypeScript types for using MML components in React

## Web Packages
MML can be used in a web browser to create 3D web experiences. Networking is optional and different libraries can be used to provide the 3D graphics.

* [./packages/mml-web](./packages/mml-web) - `@mml-io/mml-web` - MML Library that handles MML elements and attributes
* [./packages/mml-web-client](./packages/mml-web-client) - `@mml-io/mml-web-client` - Web MML Client (standalone script / example)
* [./packages/mml-web-threejs](./packages/mml-web-threejs) - `@mml-io/mml-web-threejs` - Graphics Adapter for MML to THREE.js
* [./packages/mml-web-threejs-standalone](./packages/mml-web-threejs-standalone) - `@mml-io/mml-web-threejs-standalone` - THREE.js app for viewing MML documents in a web browser
* [./packages/mml-web-playcanvas](./packages/mml-web-playcanvas) - `@mml-io/mml-web-playcanvas` - Graphics Adapter for MML to PlayCanvas
* [./packages/mml-web-playcanvas-standalone](./packages/mml-web-playcanvas-standalone) - `@mml-io/mml-web-playcanvas-standalone` - PlayCanvas app for viewing MML documents in a web browser

## Networking (Networked DOM)
MML is based on a set of libraries (built expressly for MML) called "Networked DOM".

Networked DOM allows running a HTML document including script tags on a server and exposing it via a websocket which allows multiple users to interact with the same instance of the document at the same time.

The server and network components necessary to support the multi-user mode are independent of the MML additions to HTML (and can be used with regular 2D HTML).

* Networked DOM
  * [./packages/mml-web-runner](./packages/mml-web-runner) - `@mml-io/mml-web-runner` - Web Runner (for running MML documents in a web browser rather than a server)
  * [./packages/networked-dom-server](./packages/networked-dom-server) - `@mml-io/networked-dom-server` - Networked DOM Library for running documents on a Node.JS server
  * [./packages/networked-dom-web](./packages/networked-dom-web) - `@mml-io/networked-dom-web` - Web Networked DOM Library (WebSocket client for Networked DOM)
  * [./packages/networked-dom-web-client](./packages/networked-dom-web-client) - `@mml-io/networked-dom-web-client` - Web Networked DOM Client (Standalone script / example)
  * [./packages/networked-dom-web-runner](./packages/networked-dom-web-runner) - `@mml-io/networked-dom-web-runner` - Web Networked DOM Runner (for running Networked DOM documents in a web browser rather than a server)
  * [./packages/networked-dom-protocol](./packages/networked-dom-protocol) - `@mml-io/networked-dom-protocol` - Networked DOM WebSocket Protocol TypeScript Definition
  * [./packages/observable-dom-common](./packages/observable-dom-common) - `@mml-io/observable-dom-common` - Observable DOM Common
  * [./packages/observable-dom](./packages/observable-dom) - `@mml-io/observable-dom` - Observable DOM (JSDOM Execution) Library
  * [./packages/networked-dom-document](./packages/networked-dom-document) - `@mml-io/networked-dom-document` - Networked DOM Document Library

## MML Viewer
MML Viewer is a standalone app that can be used to view MML documents in a web browser.

It is available at [https://viewer.mml.io/main/v1/](https://viewer.mml.io/main/v1/).

* [./packages/mml-viewer](./packages/mml-viewer) - `@mml-io/mml-viewer` - MML Viewer

# Usage of this repo

This repo contains libraries and schema definitions for MML. The most likely way to use this repo is cloning it as libraries for other projects.

1. Clone the repo
1. `npm install`
1. `npm run iterate` Builds and starts incrementally building package artefacts from sources
  * Servers should start for examples:
    * [http://localhost:7070](http://localhost:7070) - MML Example Server
    * [http://localhost:7071](http://localhost:7071) - Networked DOM Example Server

To use any of the libraries in this repo in another project, you can use `npm link` to make these dependencies linkable to your other npm project.
* `npm run link-all` Runs `npm link` in all would-be-published packages to allow using as local dependencies to develop with. It will also print the commands to link the dependencies.


# Architecture Diagram

The below diagram shows the high-level architecture of the MML system when used in a web browser with the Networked DOM server running an MML document.

```mermaid
graph TD
  subgraph Networked DOM Server
    networked-dom-server[Networked DOM Server]
    networked-dom-document[Networked DOM Document]
    jsdom[JSDOM]
    websocket[Websocket Handler]
    networked-dom-server --> networked-dom-document
    networked-dom-document --> jsdom
  end
  mml-source["MML Source Code (HTML)"]
  mml-source --> networked-dom-document
  subgraph Web Browser
    web-browser[Web Browser]
    subgraph "3D Web Experience"
      three-js-scene[THREE.js Scene]
      subgraph Networked DOM Client
        networked-dom-client[Networked DOM Client]
        dom["DOM (HTML)"]
        networked-dom-client --> dom
      end
      subgraph MML Client Library
        web-browser-mml-client[MML Remote\nDocument Instance]
        mml-three-js[MML THREE.js]
        mml-three-js -- Events --> web-browser-mml-client
        web-browser-mml-client --> mml-three-js
      end
      dom -- Rendered By --> mml-three-js
      mml-three-js -- Composed into --> three-js-scene
    end
  end
  networked-dom-client --> ws-addr
  ws-addr --> websocket
  ws-addr["ws://..."]
  websocket --> networked-dom-server
  web-browser --> web-browser-mml-client
  web-browser-mml-client --> networked-dom-client
```
