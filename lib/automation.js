const {
  aws_ssm
} = require('aws-cdk-lib');

const { Construct } = require('constructs');
const {
  AutomationDocument,
  DocumentFormat,
  Input,
  StringVariable,
  HardCodedString,
  RunCommandStep,
  StepRef,
  OnFailure,
  StringDocument, // for direct import from JSON
  HardCodedStringList,
  HardCodedStringMap,
  HardCodedDesiredState,
  ChangeInstanceStateStep,
  HardCodedNumber
} = require('@cdklabs/cdk-ssm-documents')


/* SUPPORTED IMPORT FROM JSON
// for documents only (not automation documents)
const  { Document } = require('cdk-ssm-document');


// by '@cdklabs/cdk-ssm-documents' (but aws:runCommand and aws:aws:changeInstanceState not implemented)
let content = fs.readFileSync('.json');
const myDoc = StringDocument.fromJson(this, "MyAutomationDocument", content);


// or (documents only)
const  { CommandDocument } =  = require('@cdklabs/cdk-ssm-documents')
*/

class Automation extends Construct {
  constructor(scope, id, props) {
    super(scope, id);

    const backupAutomationDocument = new AutomationDocument(this, "BackupAutomation", {
      documentFormat: DocumentFormat.JSON,
      documentName: "BackupAutomation",
      // for input parameters (in combination with StringVariable and following {{PARAMETER}} pattern inside parameters definition below)
      //docInputs: [Input.ofTypeString('MyInput', { defaultValue: 'something' })],
    });

    const stopInstanceStep = new ChangeInstanceStateStep(this, "StopInstanceStep", {
      instanceIds: HardCodedStringList.of([props.InstanceId]),
      desiredState: HardCodedDesiredState.STOPPED
    });

    const backupStep = new RunCommandStep(this, "BackupStep", {
      explicitNextStep: StepRef.fromName("StopInstanceStep"),
      documentName: HardCodedString.of('AWS-RunShellScript'),
      parameters: HardCodedStringMap.of({
        commands: [
          'cd codebase/firefly',
          'docker run --rm -v /backup:/backup -v firefly_db:/tmp alpine tar -czvf /backup/firefly_db.tar.gz /tmp'
        ],
        workingDirectory: ['/home/ubuntu'],
        executionTimeout: ['3600']
      }),
      targets: HardCodedStringList.of([props.InstanceId]),
      commandTimeoutSeconds: HardCodedNumber.of(600)
    })

    backupAutomationDocument.addStep(backupStep);
    backupAutomationDocument.addStep(stopInstanceStep);

    console.log('Automation document for backup generated:');
    console.log(backupAutomationDocument.print())

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

    const shellScriptTask = new aws_ssm.CfnMaintenanceWindowTask(this, 'BackupTask', {
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
