# Lightning maps POC

This is a SFDX project that contains a POC for using maps in Lightning

1. Create a scratch org from a dev hub which has LWC enabled

	sfdx force:auth:web:login -d
	sfdx force:org:create -d 30 -f config/project-scratch-def.json -s

2. Push the code

	sfdx force:source:push


