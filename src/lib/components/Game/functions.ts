import type { StateMachineInstance } from '@rive-app/canvas-advanced';
import type { Character } from './types';

export function getInputByName(machine: StateMachineInstance, inputName: string) {
	for (let i = 0, l = machine.inputCount(); i < l; i++) {
		const input = machine.input(i);
		if (input.name === inputName) {
			if (inputName === 'walking' || inputName === 'isBlue') {
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
export function setHeroMovement(
	elapsedTimeSec: number,
	hero: Character,
	levelBoundaries: { maxX: number; maxY: number; minX: number; minY: number },
	boostFactor: number = 1
): void {
	// Determine if the movement is diagonal to adjust the speed accordingly
	const isDiagonal =
		(hero.movement.up || hero.movement.down) && (hero.movement.left || hero.movement.right);
	const movementSpeed = isDiagonal
		? (hero.speed / Math.sqrt(2)) * elapsedTimeSec * boostFactor
		: hero.speed * elapsedTimeSec * boostFactor;

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

export function setLinearMovement(elapsedTimeSec: number, character: Character, target: Character) {
	if (character.isDead) {
		return;
	}
	const dx = target.x - character.x;
	const dy = target.y - character.y;
	const angle = Math.atan2(dy, dx);
	const speed = character.speed * elapsedTimeSec;

	character.x += Math.cos(angle) * speed;
	character.y += Math.sin(angle) * speed;
}

export function checkEnemyCollision(hero: Character, enemy: Character) {
	const enemyRect = getCharacterRect(enemy);
	const heroRect = getCharacterRect(hero);

	if (
		heroRect.x < enemyRect.x + enemyRect.width &&
		heroRect.x + heroRect.width > enemyRect.x &&
		heroRect.y < enemyRect.y + enemyRect.height &&
		heroRect.y + heroRect.height > enemyRect.y
	) {
		return true;
	}
	return false;
}

export function checkSwordHit(
	hero: Character,
	enemy: Character,
	swordHitbox: { width: number; height: number }
) {
	const swordRect = getSwordRect(hero, swordHitbox);
	const enemyRect = getCharacterRect(enemy);

	if (
		swordRect.x < enemyRect.x + enemyRect.width &&
		swordRect.x + swordRect.width > enemyRect.x &&
		swordRect.y < enemyRect.y + enemyRect.height &&
		swordRect.y + swordRect.height > enemyRect.y
	) {
		return true;
	}
	return false;
}

/**
 * Applies knockback to a character based on the position of an offender.
 *
 * @param victim The character receiving the knockback.
 * @param offender The character causing the knockback.
 * @param knockbackStrength The strength of the knockback effect.
 */
export function applyKnockback(
	victim: Character,
	offender: Character,
	knockbackStrength: number,
	levelBoundaries: { maxX: number; maxY: number; minX: number; minY: number },
	canExceedBoundaries: boolean = true
): void {
	const victimPosition = getCharacterRect(victim);
	const offenderPosition = getCharacterRect(offender);

	const deltaX = victimPosition.x - offenderPosition.x;
	const deltaY = victimPosition.y - offenderPosition.y;

	const normalizationFactor = 100;
	const normalizedX = deltaX / normalizationFactor;
	const normalizedY = deltaY / normalizationFactor;

	victim.x += normalizedX * knockbackStrength;
	victim.y += normalizedY * knockbackStrength;

	if (!canExceedBoundaries) {
		keepInBounds(victim, levelBoundaries);
	}
}

export function keepInBounds(
	character: Character,
	levelBoundaries: { maxX: number; maxY: number; minX: number; minY: number }
) {
	if (character.x >= levelBoundaries.maxX) {
		character.x = levelBoundaries.maxX;
	} else if (character.x <= levelBoundaries.minX) {
		character.x = levelBoundaries.minX;
	} else if (character.y >= levelBoundaries.maxY) {
		character.y = levelBoundaries.maxY;
	} else if (character.y <= levelBoundaries.minY) {
		character.y = levelBoundaries.minY;
	}
}

export function isOutOfBounds(
	character: Character,
	levelBoundaries: { maxX: number; maxY: number; minX: number; minY: number }
) {
	const result = { x: false, y: false };
	if (character.x > levelBoundaries.maxX) {
		result.x = true;
	} else if (character.x < levelBoundaries.minX) {
		result.x = true;
	} else if (character.y > levelBoundaries.maxY) {
		result.y = true;
	} else if (character.y < levelBoundaries.minY) {
		result.y = true;
	}
	return result;
}
