<script lang="ts">
	import RiveCanvas, { type StateMachineInstance } from '@rive-app/canvas-advanced';
	import { onMount } from 'svelte';
	import riveWASMResource from '@rive-app/canvas-advanced/rive.wasm';
	import type { Character } from './types';
	import { getInputByName, getCharacterRect, getSwordRect, getHeroMovement } from './functions';

	const enemies: Character[] = [];
	const hero: Character = {
		health: 3,
		speed: 500,
		hitbox: {
			width: 100,
			height: 100
		},
		x: 500,
		y: 450,
		artboard: null,
		machine: null,
		inputs: {},
		inputNames: ['attack', 'hit', 'walking', 'up', 'down', 'left', 'right'],
		mainWrapper: null,
		movement: {
			up: false,
			down: false,
			left: false,
			right: false
		},
		orientation: 'down'
	};

	const artboardScale = 4; //determines how big individual artboards are drawn
	const levelBoundaries = {
		maxX: 1000,
		maxY: 1000,
		minX: 0,
		minY: 0
	};
	const swordHitbox = {
		width: 200,
		height: 100
	};

	const slimeHitbox = {
		width: 100,
		height: 100
	};

	const initialSlimeCount = 5;
	for (let i = 0; i < initialSlimeCount; i++) {
		enemies.push({
			health: 1,
			speed: 450,
			hitbox: {
				width: 88,
				height: 80
			},
			x: 500,
			y: 100,
			artboard: null,
			machine: null,
			inputs: {},
			inputNames: ['hit'],
			mainWrapper: null,
			movement: {
				up: false,
				down: false,
				left: false,
				right: false
			},
			orientation: 'down'
		});
	}

	let lastTime: number;
	let canvasElement: HTMLCanvasElement;
	let isSwingingSword = false;
	let timeSinceSwing = 0;

	function checkEnemyCollision() {
		const slimeX = enemies[0].x - enemies[0].hitbox.width / 2;
		const slimeY = enemies[0].y - enemies[0].hitbox.height / 2;
		const heroX = hero.x - hero.hitbox.width / 2;
		const heroY = hero.y - hero.hitbox.height / 2;

		if (
			heroX < slimeX + enemies[0].hitbox.width &&
			heroX + hero.hitbox.width > slimeX &&
			heroY < slimeY + enemies[0].hitbox.height &&
			heroY + hero.hitbox.height > slimeY
		) {
			return true;
		}
		return false;
	}

	function checkSwordHit() {
		const heroX = hero.x - hero.hitbox.width / 2;
		const heroY = hero.y - hero.hitbox.height / 2;
		const swordX = heroX + swordHitbox.width;
		const swordY = heroY + swordHitbox.height;
		const slimeX = enemies[0].x - enemies[0].hitbox.width / 2;
		const slimeY = enemies[0].y - enemies[0].hitbox.height / 2;
		if (
			swordX < slimeX + enemies[0].hitbox.width &&
			swordX + swordHitbox.width > slimeX &&
			swordY < slimeY + enemies[0].hitbox.height &&
			swordY + swordHitbox.height > slimeY
		) {
			enemies[0].inputs.hit.fire();
		}
	}

	async function main() {
		const rive = await RiveCanvas({
			// Loads Wasm bundle
			locateFile: () => riveWASMResource
		});

		const canvasRef = canvasElement;

		const renderer = rive.makeRenderer(canvasRef);
		const bytes = await (await fetch(new Request('rive-files/hero_demo.riv'))).arrayBuffer();
		const file = await rive.load(new Uint8Array(bytes));

		//setup hero
		const heroArtboard = file.artboardByName('Hero');
		const heroMainWrapper = heroArtboard.node('main wrapper');
		heroMainWrapper.scaleX = artboardScale;
		heroMainWrapper.scaleY = artboardScale;
		const heroMachine = new rive.StateMachineInstance(
			heroArtboard.stateMachineByName('State Machine 1'),
			heroArtboard
		);
		hero.inputNames.forEach((triggerName) => {
			hero.inputs[triggerName] = getInputByName(heroMachine, triggerName);
		});

		//setup slime
		const slimeArtboard = file.artboardByName('Slime');
		const slimeMainWrapper = slimeArtboard.node('main wrapper');
		slimeMainWrapper.scaleX = artboardScale;
		slimeMainWrapper.scaleY = artboardScale;
		const slimeMachine = new rive.StateMachineInstance(
			slimeArtboard.stateMachineByName('State Machine 1'),
			slimeArtboard
		);
		enemies.forEach((enemy) => {
			enemy.artboard = file.artboardByName('Slime');
			enemy.mainWrapper = enemy.artboard.node('main wrapper');
			enemy.mainWrapper.scaleX = artboardScale;
			enemy.mainWrapper.scaleY = artboardScale;
			enemy.machine = new rive.StateMachineInstance(
				enemy.artboard.stateMachineByName('State Machine 1'),
				enemy.artboard
			);
			enemy.inputNames.forEach((triggerName) => {
				enemy.inputs[triggerName] = getInputByName(
					enemy.machine as StateMachineInstance,
					triggerName
				);
			});
		});
		function gameLoop(time: number) {
			if (!lastTime) {
				lastTime = time;
			}
			const elapsedTimeMs = time - lastTime;
			const elapsedTimeSec = elapsedTimeMs / 1000;
			lastTime = time;

			renderer.clear();

			//draw enemies
			slimeArtboard.advance(elapsedTimeSec);
			slimeMachine.advance(elapsedTimeSec);
			slimeMainWrapper.x = enemies[0].x;
			slimeArtboard.draw(renderer);

			//draw hero
			getHeroMovement(elapsedTimeSec, hero, levelBoundaries);
			heroArtboard.advance(elapsedTimeSec);
			heroMachine.advance(elapsedTimeSec);
			heroMainWrapper.x = hero.x;
			heroMainWrapper.y = hero.y;
			heroArtboard.draw(renderer);
			renderer.save();

			//check for collisions with enemies
			if (checkEnemyCollision()) {
				hero.inputs.hit.fire();
			}

			//draw hitboxes
			//@ts-ignore
			renderer.fillStyle = 'rgba(255, 0, 0, 0.5)';

			const heroRect = getCharacterRect(hero);
			//@ts-ignore
			renderer.fillRect(heroRect.x, heroRect.y, heroRect.width, heroRect.height);

			const enemyRect = getCharacterRect(enemies[0]);
			//@ts-ignore
			renderer.fillRect(enemyRect.x, enemyRect.y, enemyRect.width, enemyRect.height);

			//check for sword hit
			if (isSwingingSword) {
				timeSinceSwing += elapsedTimeSec;
				if (timeSinceSwing > 0.2) {
					isSwingingSword = false;
					timeSinceSwing = 0;
				}
				checkSwordHit();

				//draw sword hitbox
				const swordRect = getSwordRect(hero, swordHitbox);
				//@ts-ignore
				renderer.fillRect(swordRect.x, swordRect.y, swordRect.width, swordRect.height);
			}

			rive.requestAnimationFrame(gameLoop);
		}
		rive.requestAnimationFrame(gameLoop);
	}

	onMount(() => {
		main();
		addEventListener('keydown', (event) => {
			if (event.code === 'KeyW') {
				hero.movement.up = true;
				hero.inputs.up.fire();
				hero.orientation = 'up';
				hero.inputs.walking.value = 1;
			} else if (event.code === 'KeyS') {
				hero.movement.down = true;
				hero.inputs.down.fire();
				hero.orientation = 'down';
				hero.inputs.walking.value = 1;
			} else if (event.code === 'KeyA') {
				hero.movement.left = true;
				hero.inputs.left.fire();
				hero.orientation = 'left';
				hero.inputs.walking.value = 1;
			} else if (event.code === 'KeyD') {
				hero.movement.right = true;
				hero.inputs.right.fire();
				hero.orientation = 'right';
				hero.inputs.walking.value = 1;
			} else if (event.code === 'Space') {
				if (timeSinceSwing > 0) return;
				hero.inputs.attack.fire();
				isSwingingSword = true;
				timeSinceSwing = 0;
			}
		});

		addEventListener('keyup', (event) => {
			if (event.code === 'KeyW') {
				hero.movement.up = false;
			} else if (event.code === 'KeyS') {
				hero.movement.down = false;
			} else if (event.code === 'KeyA') {
				hero.movement.left = false;
			} else if (event.code === 'KeyD') {
				hero.movement.right = false;
			}
			if (Object.values(hero.movement).every((value) => !value)) {
				hero.inputs.walking.value = 0;
			}
		});
	});
</script>

<div class="wrapper">
	<canvas height="1000" width="1000" bind:this={canvasElement}></canvas>
</div>

<style>
	.wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		overflow: hidden;
		height: 100vh;
		height: 100svh;
		width: 100vw;
		width: 100svw;
		background-color: #22282c;
	}
	canvas {
		height: calc(min(100vh, 100vw) - 50px);
		width: calc(min(100vw, 100vh) - 50px);
		max-height: 500px;
		max-width: 500px;
		background-color: #2a3035;
		border-radius: 16px;
	}
</style>
