const {
  RemovalPolicy, Expiration, Duration, Stack,
  aws_s3
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

const os = require("os");
const path = require('path');

class S3 extends Stack {

  deployCodebase(serviceName, folderName, bucket) {
    console.log("Deploying files from:");
    const codebaseFolder = path.join(os.homedir(), folderName);
    console.log(codebaseFolder);
    console.log();

    const deployment = new BucketDeployment(this, 'CodeStorageDeployment' + serviceName, {
      sources: [Source.asset(codebaseFolder)],
      destinationBucket: bucket,
      retainOnDelete: false,
      // commented because it causes unnecessary diffs
      //expires: Expiration.after(Duration.minutes(30)), // metadata only, does not impact on lifecycle, assets will not be deleted
      exclude: ['**/node_modules/**', '**/dist/**', '.git/*'], // vs include:
      destinationKeyPrefix: serviceName,
      prune: true, // default, create from scratch
      storageClass: StorageClass.STANDARD,
    });

    return deployment;
  }

  constructor(scope, id, props) {
    super(scope, id, props);

    const codeStorage = new Bucket(this, 'CodeStorage', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED, // default (no ACL)
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false, // default
      publicReadAccess: false, // default
      lifecycleRules: [
        {
          // optionally apply object name filtering
          // prefix: 'data/',
          abortIncompleteMultipartUploadAfter: Duration.days(1),
          expiration: Duration.days(1),
        },
      ],
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
      lifecycleRules: [
        {
          // optionally apply object name filtering
          // prefix: 'data/',
          abortIncompleteMultipartUploadAfter: Duration.days(1),
          expiration: Duration.days(60),
          transitions: [
            {
              storageClass: aws_s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(30),
            },
            /*
            {
              // The transition to INTELLIGENT_TIERING must come at least 30 days after the transition to INFREQUENT_ACCESS.
              storageClass: aws_s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: Duration.days(60),
            },
            {
              // The transition to GLACIER must come at least 30 days after the transition to INTELLIGENT_TIERING.
              storageClass: aws_s3.StorageClass.GLACIER,
              transitionAfter: Duration.days(90),
            },
            {
              // The transition to DEEP_ARCHIVE must come at least 90 days after the transition to GLACIER.
              storageClass: aws_s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: Duration.days(180),
            },
            */
          ],
        },
      ],
    });

    let deploymentPrevious = null;
    for (let i = 0; i < props.codebaseFolders.length; i++) {
      const deploymentNew = this.deployCodebase(props.codebaseFolders[i].serviceName, props.codebaseFolders[i].folderName, codeStorage);
      if (deploymentPrevious != null) {
        deploymentNew.node.addDependency(deploymentPrevious);
      }
      deploymentPrevious = deploymentNew;
    }

    this.codeStorage = deploymentPrevious.deployedBucket;
  }
}

module.exports = { S3 }
