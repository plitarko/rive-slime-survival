import type { StateMachineInstance } from '@rive-app/canvas-advanced';
import type { Character } from './types';

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

export function getCharacterRect(character: Character) {
	return {
		x: character.x - character.hitbox.width / 2,
		y: character.y - character.hitbox.height / 2,
		width: character.hitbox.width,
		height: character.hitbox.height
	};
}

/**
 * Calculates and returns the hitbox for the sword based on the hero's orientation.
 *
 * @param {Character} hero - The character object representing the hero.
 * @param {Object} swordHitbox - The dimensions of the sword's hitbox, containing width and height properties.
 * @returns {Object} The calculated hitbox for the sword, with properties x, y, width, and height.
 */
export function getSwordRect(
	hero: Character,
	swordHitbox: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
	let rect = { x: 0, y: 0, width: 0, height: 0 };

	switch (hero.orientation) {
		case 'down':
			rect = {
				x: hero.x - hero.hitbox.width,
				y: hero.y + hero.hitbox.height / 2,
				width: swordHitbox.width,
				height: swordHitbox.height
			};
			break;
		case 'up':
			rect = {
				x: hero.x - hero.hitbox.width,
				y: hero.y - hero.hitbox.height / 2 - swordHitbox.height,
				width: swordHitbox.width,
				height: swordHitbox.height
			};
			break;
		case 'left':
			rect = {
				x: hero.x - hero.hitbox.width / 2 - swordHitbox.height,
				y: hero.y - hero.hitbox.height / 2 - swordHitbox.height / 2,
				width: swordHitbox.height,
				height: swordHitbox.width
			};
			break;
		case 'right':
			rect = {
				x: hero.x + hero.hitbox.width / 2,
				y: hero.y - hero.hitbox.height / 2 - swordHitbox.height / 2,
				width: swordHitbox.height,
				height: swordHitbox.width
			};
			break;
	}

	return rect;
}

/**
 * Calculates the new position of a character based on its movement and speed within specified level boundaries.
 * @param elapsedTimeSec The elapsed time in seconds since the last calculation.
 * @param hero The character whose movement is being calculated.
 * @param levelBoundaries The boundaries of the level within which the character can move.
 */
export function getHeroMovement(
	elapsedTimeSec: number,
	hero: Character,
	levelBoundaries: { maxX: number; maxY: number; minX: number; minY: number }
): void {
	// Determine if the movement is diagonal to adjust the speed accordingly
	const isDiagonal =
		(hero.movement.up || hero.movement.down) && (hero.movement.left || hero.movement.right);
	const movementSpeed = isDiagonal
		? (hero.speed / Math.sqrt(2)) * elapsedTimeSec
		: hero.speed * elapsedTimeSec;

	// Adjust the hero's position based on movement direction, ensuring they do not exit the level boundaries
	if (hero.movement.up && hero.y - movementSpeed >= levelBoundaries.minY) {
		hero.y -= movementSpeed;
	} else if (hero.movement.up) {
		hero.y = levelBoundaries.minY;
	}

	if (hero.movement.down && hero.y + movementSpeed <= levelBoundaries.maxY) {
		hero.y += movementSpeed;
	} else if (hero.movement.down) {
		hero.y = levelBoundaries.maxY;
	}

	if (hero.movement.left && hero.x - movementSpeed >= levelBoundaries.minX) {
		hero.x -= movementSpeed;
	} else if (hero.movement.left) {
		hero.x = levelBoundaries.minX;
	}

	if (hero.movement.right && hero.x + movementSpeed <= levelBoundaries.maxX) {
		hero.x += movementSpeed;
	} else if (hero.movement.right) {
		hero.x = levelBoundaries.maxX;
	}
}
