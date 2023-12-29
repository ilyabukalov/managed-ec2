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
      /* Instance connect is already preinstalled on Ubuntu 22.04
      'apt-get install -y ec2-instance-connect',
      */
      'apt-get install -y awscli',
      'snap start amazon-ssm-agent', // amazon-ssm-agent is pre-installed on Ubuntu 22.04 but requires manual execution
      'mkdir -p /home/ubuntu/codebase',
      'aws s3 cp s3://' +
      props.codeStorageBucket.bucketName +
      '/ /home/ubuntu/codebase --recursive',
      /*    // Cloudwatch (but need to create /tmp/amazon-cloudwatch-agent.json beforehand)
            'curl -LO https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb  &&  apt install -y ./amazon-cloudwatch-agent.deb',
            '/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/tmp/amazon-cloudwatch-agent.json'
      */
      'chown -R ubuntu:ubuntu /home/ubuntu/codebase',
      // docker
      'apt install -y apt-transport-https ca-certificates curl software-properties-common',
      'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg',
      'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null',
      'apt update -y',
      'apt install -y docker-ce',
      'usermod -aG docker ubuntu',
      /* advised to update but not used because docker has pre-installed compose already (with lower version)
      'mkdir -p ~/.docker/cli-plugins/',
      'curl -SL https://github.com/docker/compose/releases/download/v2.3.3/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose',
      'chmod +x ~/.docker/cli-plugins/docker-compose'
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
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'), // for amazon-ssm-agent mandatory
        /* Cloudwatch
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
        */
      ],
    });

    // Grant the EC2 role access to the bucket
    props.codeStorageBucket.grantRead(serverRole); // instaed of: ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
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

    // add one more additional security group
    this.instance.addSecurityGroup(props.httpSecurityGroup);
  }
}

module.exports = { Server }
