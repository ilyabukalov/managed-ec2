const {
  RemovalPolicy, Expiration, Duration
} = require('aws-cdk-lib');

const {
  Bucket,
  ObjectOwnership,
  BucketEncryption,
  BlockPublicAccess
} = require('aws-cdk-lib/aws-s3');

const {
  Source,
  BucketDeployment,
  StorageClass
} = require('aws-cdk-lib/aws-s3-deployment');

const { Construct } = require('constructs');

const os = require("os");
const path = require('path');

class S3 extends Construct {

  deployCodebase(folderName, bucket) {
    console.log("Deploying files from:");
    const codebaseFolder = path.join(os.homedir(), folderName);
    console.log(codebaseFolder);
    console.log();

    const deployment = new BucketDeployment(this, 'CodeStorageDeployment' + folderName, {
      sources: [Source.asset(codebaseFolder)],
      destinationBucket: bucket,
      retainOnDelete: false,
      expires: Expiration.after(Duration.minutes(30)), // metadata only, does not impact on lifecycle, assets will not be deleted
      exclude: ['**/node_modules/**', '**/dist/**', '.git/*'], // vs include:
      destinationKeyPrefix: folderName,
      prune: true, // default, create from scratch
      storageClass: StorageClass.STANDARD,
    });

    return deployment;
  }

  constructor(scope, id, props) {
    super(scope, id);

    const codeStorage = new Bucket(this, 'CodeStorage', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED, // default (no ACL)
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false, // default
      publicReadAccess: false, // default
    });

    this.backupBucket = new Bucket(this, 'BackupBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN, // or SNAPSHOT
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED, // default (no ACL)
      autoDeleteObjects: false, // double protection
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      publicReadAccess: false, // default
    });

    let deploymentPrevious = null;
    for (let i = 0; i < props.codebaseFolders.length; i++) {
      const deploymentNew = this.deployCodebase(props.codebaseFolders[i], codeStorage);
      if (deploymentPrevious != null) {
        deploymentNew.node.addDependency(deploymentPrevious);
      }
      deploymentPrevious = deploymentNew;
    }

    this.codeStorage = deploymentPrevious.deployedBucket;
  }
}

module.exports = { S3 }
