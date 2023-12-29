npm run cdk bootstrap aws://123456789012/us-east-1
#
ssh-keygen -m PEM -f ~/.ssh/aws_rsa_personal
export KEY_FILE_NAME=.ssh/aws_rsa_personal
# aws ssm get-parameters --names /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id
# 20230919 instead of "current"
export MACHINE_IMAGE_ID=/aws/service/canonical/ubuntu/server/22.04/stable/20230919/amd64/hvm/ebs-gp2/ami-id
# extraxt root device name:
# aws ec2 describe-images --region us-east-1 --image-ids ami-0fc5d935ebf8bc3bc
export MACHINE_ROOT_VOLUME=/dev/sda1
# to enable system manager plugin (aws ssm start-session) to work with aws-cli - need to run native aws-cli (not docker container). Plugin does not work in docker aws-cli setup

npm run cdk deploy "*"
npm run cdk destroy "*"