import type { Artboard, StateMachineInstance, SMIInput, Node } from '@rive-app/canvas-advanced';

export interface Character {
	health: number;
	maxHealth: number;
	speed: number;
	hitbox: { width: number; height: number };
	x: number;
	y: number;
	artboard: Artboard | null;
	altArtboards: { artboard: Artboard; mainWrapper: Node; machine: StateMachineInstance }[] | [];
	machine: StateMachineInstance | null;
	inputRefs: { [key: string]: SMIInput };
	inputs: { name: string; type: 'bool' | 'trigger' }[];
	mainWrapper: Node | null;
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
	mainWrapper: Node | null;
	machine: StateMachineInstance;
	inputRefs: { [key: string]: SMIInput };
	inputs: { name: string; type: 'bool' | 'trigger' }[];
}
