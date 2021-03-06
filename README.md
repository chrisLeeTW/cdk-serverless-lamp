
[![NPM version](https://badge.fury.io/js/cdk-serverless-lamp.svg)](https://badge.fury.io/js/cdk-serverless-lamp)
[![PyPI version](https://badge.fury.io/py/cdk-serverless-lamp.svg)](https://badge.fury.io/py/cdk-serverless-lamp)
![Release](https://github.com/pahud/cdk-serverless-lamp/workflows/Release/badge.svg)

# Welcome to cdk-serverless-lamp

`cdk-serverless-lamp` is a JSII construct library for AWS CDK that allows you to deploy the [New Serverless LAMP Stack](https://aws.amazon.com/tw/blogs/compute/introducing-the-new-serverless-lamp-stack/) running PHP Laravel Apps by specifying the local `laravel` directory.

By deploying this stack, it creates the following resources for you:

1. Amazon API Gateway HTTP API
2. AWS Lambda custom runtime with [Bref runtime](https://bref.sh/docs/runtimes/) support
3. Amazon Aurora for MySQL database cluster with RDS proxy enabled

## Usage

Building your serverless Laravel with `ServerlessLaravel` construct:

```ts
import { ServerlessLaravel } from 'cdk-serverless-lamp';
import { App, Stack } from '@aws-cdk/core';
import * as path from 'path';

const app = new App();
const stack = new Stack(app, 'ServerlessLaraval');

// the DatabaseCluster sharing the same vpc with the ServerlessLaravel
const db = new DatabaseCluster(stack, 'DatabaseCluster', {
  vpc,
  instanceType: new InstanceType('t3.small'),
  rdsProxy: true,
})

// the ServerlessLaravel
new ServerlessLaravel(stack, 'ServerlessLaravel', {
  brefLayerVersion: 'arn:aws:lambda:ap-northeast-1:209497400698:layer:php-74-fpm:11',
  laravelPath: path.join(__dirname, '../../codebase'),
  vpc,
  databaseConfig: {
    writerEndpoint: db.rdsProxy!.endpoint,
  },
});
```

On deploy complete, the API Gateway URL will be returned in the Output. Click the URL and you will see the Laravel landing page:

![laravel-welcome](./images/laravel.png)

## Prepare the Laravel and bref

```bash
$ git clone https://github.com/pahud/cdk-serverless-lamp.git
$ cd cdk-serverless-lamp && mkdir codebase
# create a laravel project
$ docker run --rm -ti \
  --volume $PWD:/app \
  composer create-project --prefer-dist laravel/laravel ./codebase
# enter this project
cd codebase
# install bref in the vendor
$ docker run --rm -ti \
  --volume $PWD:/app \
  composer require bref/bref bref/laravel-bridge
```

_(more information can be found in [bref documentation](https://bref.sh/docs/frameworks/laravel.html))_

what if you like to do some local develop ?

add follow to `docker-compose.yml`

```docker-compose
version: "3.5"
services:
  web:
    image: bref/fpm-dev-gateway
    ports:
      - "8000:80"
    volumes:
      - ./laravel:/var/task
    depends_on:
      - php
    environment:
      HANDLER: public/index.php
  php:
    image: bref/php-74-fpm-dev
    volumes:
      - ./laravel:/var/task
```

and run this command `docker-compose up -d` and now you can access <http://localhost:8000>.

_(more information can be found in [bref documentation](https://bref.sh/docs/local-development.html))_

## Amazon RDS Cluster and Proxy

Use `DatabaseCluster` construct to create your database clusters.

```ts
const db = new DatabaseCluster(stack, 'DatabaseCluster', {
  vpc,
  instanceType: new InstanceType('t3.small'),
  // enable rds proxy for this cluster
  rdsProxy: true,
  // one writer and one read replica
  instanceCapacity: 2,
})
```
