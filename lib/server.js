const {
  SubnetType,
  Instance,
  InstanceType,
  InstanceClass,
  InstanceSize,
  UserData,
  MachineImage,
  AmazonLinuxCpuType,
  BlockDeviceVolume,
  EbsDeviceVolumeType,
  CfnEIPAssociation,
} = require('aws-cdk-lib/aws-ec2');

const {
  Role,
  ServicePrincipal,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
} = require('aws-cdk-lib/aws-iam');

const { Construct } = require('constructs');

class Server extends Construct {
  constructor(scope, id, props) {
    super(scope, id);

    const userData = UserData.forLinux();

    userData.addCommands(
      'apt-get update -y',
      'apt update -y',
      'apt-get install -y awscli ec2-instance-connect',
      'mkdir -p /home/ubuntu/codebase',
      'chown -R ubuntu:ubuntu /home/ubuntu/codebase',
      'aws s3 cp s3://' +
      codeStorageBucket.bucketName +
      '/ /home/ubuntu/codebase --recursive',
      /*    // Cloudwatch (but need to create /tmp/amazon-cloudwatch-agent.json beforehand)
            'curl -LO https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb  &&  apt install -y ./amazon-cloudwatch-agent.deb',
            '/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/tmp/amazon-cloudwatch-agent.json'
      */
    )

    const instanceClass = InstanceClass.T2;
    const instanceSize = InstanceSize.MICRO;

    // Create a role for the EC2 instance to assume.  This role will allow the instance to put log events to CloudWatch Logs
    const serverRole = new Role(this, 'InstanceRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      /* Cloudwatch
      inlinePolicies: {
        ['RetentionPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['logs:PutRetentionPolicy'],
            }),
          ],
        }),
      },
      */
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        /* Cloudwatch
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
        */
      ],
    });

    // Grant the EC2 role access to the bucket
    codeStorageBucket.grantRead(serverRole); // instaed of: ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
    // Create the EC2 instance
    this.instance = new Instance(this, 'Instance', {
      keyName: props.sshKey,
      vpc: props.vpc,
      instanceType: InstanceType.of(instanceClass, instanceSize), // instanceType: new ec2.InstanceType('t2.micro')
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
        availabilityZones: [props.az],
      },
      blockDevices: [{
        deviceName: process.env.MACHINE_ROOT_VOLUME,
        volume: BlockDeviceVolume.ebs(10, {
          deleteOnTermination: true,
          encrypted: false,
          /*
          iops: 3000,
          throughput: 125,
          */
          volumeType: EbsDeviceVolumeType.GP3,
        }),
      }],

      machineImage: MachineImage.fromSsmParameter(process.env.MACHINE_IMAGE_ID),

      /* for Amazon images
      machineImage: MachineImage.latestAmazonLinux2023({
        cachedInContext: false,
        cpuType: AmazonLinuxCpuType.X86_64,
      }),
      */
      userData: userData, // alternative to it is: this.instance.addUserData(ShellStringFromFile);
      securityGroup: props.sshSecurityGroup,
      role: serverRole,
    });

    new CfnEIPAssociation(this, "Ec2Association", {
      allocationId: props.eip.attrAllocationId,
      instanceId: this.instance.instanceId
    });

    // Just in case if need one more additional security group
    //this.instance.addSecurityGroup(props.sshSecurityGroup);
  }
}

module.exports = { Server }
