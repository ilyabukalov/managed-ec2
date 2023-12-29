const {
  SecurityGroup,
  Peer,
  Port,
  SubnetType,
  Vpc,
  IpAddresses,
  CfnEIP,

} = require('aws-cdk-lib/aws-ec2');

const {
  Aspects,
  Tag,
} = require('aws-cdk-lib');

const { Construct } = require('constructs');

class Network extends Construct {
  constructor(scope, id) {
    super(scope, id);

    /*
    const defaultVpc = Vpc.fromLookup(this, 'VPC', {
      isDefault: true
    })
    */

    // Create a VPC with public subnets in 1 AZs
    this.vpc = new Vpc(this, 'VPC', {
      ipAddresses: IpAddresses.cidr('10.16.0.0/16'),
      natGateways: 0,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: false,
        },
        {
          name: 'isolated',
          subnetType: SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
        /*
        {
          name: 'private',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        */
      ],
      maxAzs: 1,
    });

    /* this way to define explicitly cidr
    const privateSubnet = new ec2.PrivateSubnet(this, 'MyPrivateSubnet', {
      availabilityZone: 'availabilityZone',
      cidrBlock: 'cidrBlock',
      vpcId: 'vpcId',
      mapPublicIpOnLaunch: false, // optional
    });
    */

    // Create a security group for SSH
    this.sshSecurityGroup = new SecurityGroup(this, 'SSHSecurityGroup', {
      vpc: this.vpc,
      description: 'Security Group for SSH',
      allowAllOutbound: true, // this is default
    });

    // Allow SSH inbound traffic on TCP port 22
    this.sshSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'allow SSH access from anywhere');

    this.httpSecurityGroup = new SecurityGroup(this, 'HTTPSecurityGroup', {
      vpc: this.vpc,
      description: 'Security Group for HTTP',
      allowAllOutbound: true, // this is default
    });

    this.httpSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'allow HTTP access from anywhere');

    // rename
    Aspects.of(this.sshSecurityGroup).add(new Tag('Name', 'SSHSecurityGroup'));

    this.eip = new CfnEIP(this, "Ip");

    /*
    EXAMPLES:
    1. Allow all incoming only from inside VPC
    sg.addIngressRule(Peer.ipv4('10.0.0.0/16'), Port.anyIpv4());

    2. Allow outgoing only to 80 to any IP
    allowAllOutbound: false
    sg.addEgressRule(Peer.anyIpv4(), Port.tcp(80));
    */
  }
}

module.exports = { Network }
