/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Artboard, StateMachineInstance } from '@rive-app/canvas-advanced';

export interface Character {
	health: number;
	maxHealth: number;
	speed: number;
	hitbox: { width: number; height: number };
	x: number;
	y: number;
	artboard: Artboard | null;
	altArtboards: { artboard: Artboard; mainWrapper: any; machine: StateMachineInstance }[] | [];
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
	timeSinceLastHit: number;
	isDead: boolean;
	timeSinceDeath: number;
}

export interface ArtboardData {
	artboard: Artboard;
	mainWrapper: any;
	machine: StateMachineInstance;
	inputs: { [key: string]: any };
	inputNames: string[];
}
