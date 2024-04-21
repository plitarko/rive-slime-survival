import type { StateMachineInstance } from '@rive-app/canvas-advanced';
import type { Character } from './types';

export function getInputByName(
	machine: StateMachineInstance,
	input: { name: string; type: 'trigger' | 'bool' }
) {
	for (let i = 0, l = machine.inputCount(); i < l; i++) {
		const inputRef = machine.input(i);
		if (inputRef.name === input.name) {
			if (input.type === 'bool') {
				return inputRef.asBool();
			} else {
				return inputRef.asTrigger();
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

export function setHeroPosition(
	elapsedTimeSec: number,
	hero: Character,
	levelBoundaries: { maxX: number; maxY: number; minX: number; minY: number },
	boostFactor: number = 1
): void {
	const isDiagonal =
		(hero.movement.up || hero.movement.down) && (hero.movement.left || hero.movement.right);
	const movementSpeed = isDiagonal
		? (hero.speed / Math.sqrt(2)) * elapsedTimeSec * boostFactor
		: hero.speed * elapsedTimeSec * boostFactor;

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

export function getRandomSpawnCoordinates(squareSize = 1000) {
	const randomOffset = 1500 * Math.random() + 200;
	// Define the outer boundary coordinates
	const minX = -randomOffset;
	const maxX = squareSize + randomOffset;
	const minY = -randomOffset;
	const maxY = squareSize + randomOffset;

	let x, y;

	// Randomly decide to place the point on the horizontal or vertical axis
	if (Math.random() < 0.5) {
		// Horizontal axis (left or right)
		x = Math.random() < 0.5 ? minX : maxX;
		y = Math.random() * (maxY - minY) + minY;
	} else {
		// Vertical axis (top or bottom)
		y = Math.random() < 0.5 ? minY : maxY;
		x = Math.random() * (maxX - minX) + minX;
	}

	return { x, y };
}
