
import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigatewayv2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as rds from '@aws-cdk/aws-rds';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as path from 'path';
import { IVpc, InstanceType, Vpc, SecurityGroup, Port } from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { RemovalPolicy } from '@aws-cdk/core';

export interface DatabaseConfig {
  /**
   * The DB writer endpoint
   */
  readonly writerEndpoint: string;

  /**
   * The DB reader endpoint
   */
  readonly readerEndpoint?: string;

  /**
   * The DB master username
   */
  readonly masterUserName?: string;

  /**
   * The DB master password secret
   */
  readonly masterUserPasswordSecret?: secretsmanager.ISecret;
}

/**
 * Construct properties for `ServerlessApi`
 */
export interface ServerlessApiProps {
  /**
   * custom lambda function for the API
   * 
   * @default - A Lambda function with Lavavel and Bref support will be created
   */
  readonly handler?: lambda.IFunction;

  /**
   * custom lambda code asset path
   * 
   * @default - DEFAULT_LAMBDA_ASSET_PATH
   */
  readonly lambdaCodePath?: string;

  /**
   * AWS Lambda layer version from the Bref runtime.
   * e.g. arn:aws:lambda:us-west-1:209497400698:layer:php-74-fpm:12
   * check the latest runtime verion arn at https://bref.sh/docs/runtimes/
   */
  readonly brefLayerVersion: string

  /**
   * The VPC for this stack
   */
  readonly vpc?: IVpc;

  /**
   * Database configurations
   */
  readonly databaseConfig?: DatabaseConfig;

  /**
   * RDS Proxy for the Lambda function
   * 
   * @default - no db proxy
   */
  readonly rdsProxy?: rds.IDatabaseProxy;

}

/**
 * Use `ServerlessApi` to create the serverless API resource
 */
export class ServerlessApi extends cdk.Construct {
  readonly handler: lambda.IFunction
  readonly vpc: IVpc;

  constructor(scope: cdk.Construct, id: string, props: ServerlessApiProps) {
    super(scope, id);

    const DEFAULT_LAMBDA_ASSET_PATH = path.join(__dirname, '../composer/laravel58-bref')
    const DEFAULT_DB_MASTER_USER = 'admin'

    this.vpc = props.vpc ?? new Vpc(this, 'Vpc', { maxAzs:3, natGateways: 1})

    this.handler = props.handler ?? new lambda.Function(this, 'handler', {
      runtime: lambda.Runtime.PROVIDED,
      handler: 'public/index.php',
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(this, 'BrefPHPLayer', props.brefLayerVersion),
      ],
      code: lambda.Code.fromAsset(props?.lambdaCodePath ?? DEFAULT_LAMBDA_ASSET_PATH),
      environment: {
        APP_STORAGE: '/tmp',
        DB_WRITER: props.databaseConfig?.writerEndpoint ?? '',
        DB_READER: props.databaseConfig?.readerEndpoint ?? props.databaseConfig?.writerEndpoint ?? '',
        DB_USER: props.databaseConfig?.masterUserName ?? DEFAULT_DB_MASTER_USER,
      },
      timeout: cdk.Duration.seconds(120),
      vpc: this.vpc,
    });

    // allow lambda execution role to connect to RDS proxy
    if(props.rdsProxy) {
      this.handler.addToRolePolicy(new iam.PolicyStatement({
        actions: [ 'rds-db:connect' ],
        resources: [ props.rdsProxy.dbProxyArn ],
      }))
    }

    const endpoint = new apigateway.HttpApi(this, 'apiservice', {
      defaultIntegration: new apigateway.LambdaProxyIntegration({
        handler: this.handler,
      }),
    });
    new cdk.CfnOutput(this, 'EndpointURL', { value: endpoint.url! })
  }
}

/**
 * Construct properties for `ServerlessLaravel`
 */
export interface ServerlessLaravelProps extends ServerlessApiProps {
  /**
   * path to your local laravel directory with bref
   */
  readonly laravelPath: string;

}

/**
 * Use `ServerlessLaravel` to create the serverless Laravel resource
 */
export class ServerlessLaravel extends ServerlessApi {
  constructor(scope: cdk.Construct, id: string, props: ServerlessLaravelProps) {
    super(scope, id, {
      lambdaCodePath: props.laravelPath,
      brefLayerVersion: props.brefLayerVersion,
      handler: props.handler,
      vpc: props.vpc,
      databaseConfig: props.databaseConfig,
      rdsProxy: props.rdsProxy,
    });
  }
}

export interface DatabaseProps {
  /**
   * database cluster engine
   * 
   * @default AURORA_MYSQL
   */
  readonly engine?: rds.IClusterEngine;

  /**
   * master username
   * 
   * @default admin
   */
  readonly masterUserName?: string;

  /**
   * The VPC for the DatabaseCluster
   */
  readonly vpc: IVpc;

  /**
   * instance type of the cluster
   * 
   * @default - t3.medium (or, more precisely, db.t3.medium)
   */
  readonly instanceType?: InstanceType;

  /**
   * enable the Amazon RDS proxy
   * 
   * @default true
   */
  readonly rdsProxy?: boolean

  /**
   * RDS Proxy Options
   */
  readonly rdsProxyOptions?: rds.DatabaseProxyOptions;

  /**
   * create single DB instance only or DB cluster with at least one read replica
   * 
   * @default false
   */
  readonly singleInstanceOnly?: boolean

}

export class DatabaseCluster extends cdk.Construct {
  readonly rdsProxy?: rds.DatabaseProxy
  readonly masterUser: string;
  readonly masterPassword: secretsmanager.ISecret;
  readonly dbCluster?: rds.IDatabaseCluster;
  readonly dbInstance?: rds.IDatabaseInstance;
  private _runBefore: cdk.IDependable[] = [];

  constructor(scope: cdk.Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    this.masterUser = props.masterUserName ?? 'admin';

    // generate and store password for masterUser in the secrets manager
    const masterUserSecret = new secretsmanager.Secret(this, 'DbMasterSecret', {
      secretName: `${cdk.Stack.of(this).stackName}-DbMasterSecret`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: this.masterUser,
        }),
        passwordLength: 12,
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
      },
    });

    this.masterPassword = masterUserSecret

    const dbConnectionGroup = new SecurityGroup(this, 'DB Secuirty Group', {
      vpc: props.vpc,
    });
    dbConnectionGroup.connections.allowInternally(Port.tcp(3306))

    if (props.singleInstanceOnly === true) {
      this.dbInstance = new rds.DatabaseInstance(this, 'DBInstance', {
        engine: rds.DatabaseInstanceEngine.MYSQL,
        masterUsername: masterUserSecret.secretValueFromJson('username').toString(),
        masterUserPassword: masterUserSecret.secretValueFromJson('password'),
        vpc: props.vpc,
        securityGroups: [ dbConnectionGroup ],
        instanceType: props.instanceType,
        deletionProtection: false,
      })
    } else {
      this.dbCluster = new rds.DatabaseCluster(this, 'DBCluster', {
        engine: rds.DatabaseClusterEngine.auroraMysql({
          version: rds.AuroraMysqlEngineVersion.VER_2_08_1,
        }),
        instanceProps: {
          vpc: props.vpc,
          instanceType: props.instanceType ?? new InstanceType('t3.medium'),
          securityGroups: [dbConnectionGroup],
        },
        masterUser: {
          username: masterUserSecret.secretValueFromJson('username').toString(),
          password: masterUserSecret.secretValueFromJson('password'),
        },
        instances: 1,
        removalPolicy: RemovalPolicy.DESTROY,
      })

      // Workaround for bug where TargetGroupName is not set but required
      let cfnDbInstance = this.dbCluster.node.children.find((child: any) => {
        return child instanceof rds.CfnDBInstance
      }) as rds.CfnDBInstance
      this._runBefore.push(cfnDbInstance)
    }

    // enable the RDS proxy by default
    if (!props.rdsProxy === false) {
      // create iam role for RDS proxy
      const rdsProxyRole = new iam.Role(this, 'RdsProxyRole', {
        assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
      })
      // see: https://aws.amazon.com/tw/blogs/compute/using-amazon-rds-proxy-with-aws-lambda/
      rdsProxyRole.addToPolicy(new iam.PolicyStatement({
        actions: [
          'secretsmanager:GetResourcePolicy',
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
          'secretsmanager:ListSecretVersionIds',
        ],
        resources: [ masterUserSecret.secretArn ],
      }))

      const proxyOptions: rds.DatabaseProxyOptions = {
        vpc: props.vpc,
        secrets: [masterUserSecret],
        iamAuth: true,
        dbProxyName: `${cdk.Stack.of(this).stackName}-RDSProxy`,
        securityGroups: [ dbConnectionGroup ],
        role: rdsProxyRole,
      }
      
      // create the RDS proxy
      if (this.dbCluster) {
        this.rdsProxy = this.dbCluster.addProxy('RDSProxy', proxyOptions)
      }
      if (this.dbInstance) {
        this.rdsProxy = this.dbInstance.addProxy('RDSProxy', proxyOptions)
      }
      
      // ensure DB instance is ready before creating the proxy
      this.rdsProxy?.node.addDependency(...this._runBefore)
    }
  }
}
