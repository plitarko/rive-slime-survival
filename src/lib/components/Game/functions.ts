import type { StateMachineInstance } from '@rive-app/canvas-advanced';

export function getInputByName(machine: StateMachineInstance, inputName: string) {
	for (let i = 0, l = machine.inputCount(); i < l; i++) {
		const input = machine.input(i);
		if (input.name === inputName) {
			if (inputName === 'walking') {
				return input.asBool();
			} else {
				return input.asTrigger();
			}
		}
	}
}
