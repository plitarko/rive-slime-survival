import type { Artboard, StateMachineInstance } from '@rive-app/canvas-advanced';

export interface Character {
	speed: number;
	health: number;
	hitbox: { width: number; height: number };
	x: number;
	y: number;
	artboard: Artboard | null;
	machine: StateMachineInstance | null;
	inputs: { [key: string]: any };
	inputNames: string[];
	mainWrapper: any;
	movement: {
		up: boolean;
		down: boolean;
		left: boolean;
		right: boolean;
	};
	orientation: 'up' | 'down' | 'left' | 'right';
}
