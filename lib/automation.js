const {
  aws_ssm
} = require('aws-cdk-lib');

const { Construct } = require('constructs');

class Automation extends Construct {
  constructor(scope, id, props) {
    super(scope, id);
    const cfnMaintenanceWindow = new aws_ssm.CfnMaintenanceWindow(this, 'EveryDayMaintenanceWindow', {
      allowUnassociatedTargets: true,
      cutoff: 0, // hours
      duration: 1, // hours
      name: 'everyDayMaintenanceWindow',
      schedule: 'rate(1 minutes)',

      // the properties below are optional
      description: 'Every day',
      //endDate: 'endDate',
      //scheduleOffset: 123,
      //scheduleTimezone: 'scheduleTimezone',
      //startDate: 'startDate',
    });

    const targetInstance = new aws_ssm.CfnMaintenanceWindowTarget(this, 'TargetInstance', {
      resourceType: 'INSTANCE',
      targets: [{
        key: 'InstanceIds',
        values: [props.InstanceId],
      }],
      windowId: cfnMaintenanceWindow.ref,
    });

    const shellScriptTask = new aws_ssm.CfnMaintenanceWindowTask(this, 'ShellScriptTask', {
      priority: 1,
      taskArn: 'AWS-RunShellScript',
      taskType: 'RUN_COMMAND',
      windowId: cfnMaintenanceWindow.ref,

      maxConcurrency: '1',
      maxErrors: '1',
      name: 'shellScriptTask',
      targets: [{
        key: 'InstanceIds',
        values: [props.InstanceId],
      }],
      taskInvocationParameters: {
        maintenanceWindowRunCommandParameters: {
          timeoutSeconds: 600,
          documentVersion: '1',
          parameters: {
            commands: [
              'cd codebase',
              'docker compose -f docker-compose.yml up -d'
            ],
            workingDirectory: ['/home/ubuntu'],
            executionTimeout: ['3600']
          },
        },
      },
    });
  }
}

module.exports = { Automation }
