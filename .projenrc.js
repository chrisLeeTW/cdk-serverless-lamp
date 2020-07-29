const {
  JsiiProject,
  Semver
} = require('projen');

const AWS_CDK_LATEST_RELEASE = '1.55.0';
const CONSTRUCTS_VERSION = '3.0.4'
const PROJECT_NAME = 'cdk-serverless-lamp';
const PROJECT_DESCRIPTION = 'A JSII construct lib to build AWS Serverless LAMP with AWS CDK';

const project = new JsiiProject({
  name: PROJECT_NAME,
  jsiiVersion: Semver.caret('1.5.0'),
  description: PROJECT_DESCRIPTION,
  repository: 'https://github.com/pahud/cdk-serverless-lamp.git',
  authorName: 'Pahud Hsieh',
  authorEmail: 'hunhsieh@amazon.com',
  stability: 'experimental',
  devDependencies: {
    '@aws-cdk/assert': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@types/jest': Semver.caret('25.2.3'),
    '@types/node': Semver.caret('14.0.11'),
    'ts-jest': Semver.caret('25.3.1'),
    'jest': Semver.caret('25.5.0'),
  },
  peerDependencies: {
    constructs: Semver.pinned(CONSTRUCTS_VERSION),
    '@aws-cdk/core': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-apigateway': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-apigatewayv2': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-ec2': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-iam': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-lambda': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-secretsmanager': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-rds': Semver.pinned(AWS_CDK_LATEST_RELEASE),
  },
  dependencies: {
    constructs: Semver.pinned(CONSTRUCTS_VERSION),
    '@aws-cdk/core': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-apigateway': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-apigatewayv2': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-ec2': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-iam': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-lambda': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-secretsmanager': Semver.pinned(AWS_CDK_LATEST_RELEASE),
    '@aws-cdk/aws-rds': Semver.pinned(AWS_CDK_LATEST_RELEASE),
  },
  python: {
    distName: 'cdk-serverless-lamp',
    module: 'cdk_serverless_lamp'
  }
});

project.addFields({
  'keywords': [
    'aws',
    'serverless',
    'lamp',
  ]
});

project.addFields({
  'awscdkio': {
    'twitter': '@pahudnet',
    'announce': false,
  }
});

project.npmignore.exclude('cdk.out', 'cdk.context.json', 'composer', 'images', 'yarn-error.log');
project.gitignore.exclude('cdk.out', 'cdk.context.json');

project.synth();
