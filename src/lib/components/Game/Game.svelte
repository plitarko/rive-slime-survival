<script lang="ts">
	import RiveCanvas from '@rive-app/canvas-advanced';
	import { onMount } from 'svelte';
	import riveWASMResource from '@rive-app/canvas-advanced/rive.wasm';
	import type { Character } from './types';
	import { getInputByName } from './functions';

	const enemies: Character[] = [];
	const hero: Character = {
		health: 3,
		speed: 40,
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
		direction: {
			up: false,
			down: false,
			left: false,
			right: false
		}
	};

	const artboardScale = 4; //determines how big individual artboards are drawn
	const levelBoundaries = {
		maxX: 1000,
		maxY: 1000,
		minX: 0,
		minY: 0
	};

	const slimeInputNames = ['hit'];
	const slimeMovementSpeed = 40;
	const slimeHitbox = {
		width: 80,
		height: 80
	};

	const initialSlimeCount = 5;
	for (let i = 0; i < initialSlimeCount; i++) {
		enemies.push({
			health: 1,
			speed: slimeMovementSpeed,
			hitbox: slimeHitbox,
			x: 500,
			y: 100,
			artboard: null,
			machine: null,
			inputs: {},
			inputNames: ['hit']
		});
	}

	let lastTime: number;
	let canvasElement: HTMLCanvasElement;
	let heroMovement = {
		up: false,
		down: false,
		left: false,
		right: false
	};
	let heroInputs: any = {};
	let slimeInputs: any = {};
	let slimePosition = { x: 500, y: 100 };

	function getMovement(elapsedTimeMs: number) {
		// Check if moving diagonally
		const isDiagonal =
			(heroMovement.up || heroMovement.down) && (heroMovement.left || heroMovement.right);

		// Determine movement speed
		const speed = isDiagonal
			? hero.speed / Math.sqrt(2) / elapsedTimeMs
			: hero.speed / elapsedTimeMs;

		// Apply movement
		if (heroMovement.up) {
			if (hero.y - speed >= levelBoundaries.minY) {
				hero.y -= speed;
			} else {
				hero.y = levelBoundaries.minY;
			}
		}
		if (heroMovement.down) {
			if (hero.y + speed <= levelBoundaries.maxY) {
				hero.y += speed;
			} else {
				hero.y = levelBoundaries.maxY;
			}
		}
		if (heroMovement.left) {
			if (hero.x - speed >= levelBoundaries.minX) {
				hero.x -= speed;
			} else {
				hero.x = levelBoundaries.minX;
			}
		}
		if (heroMovement.right) {
			if (hero.x + speed <= levelBoundaries.maxX) {
				hero.x += speed;
			} else {
				hero.x = levelBoundaries.maxX;
			}
		}
		checkEnemyCollision();
	}

	function checkEnemyCollision() {
		const slimeX = slimePosition.x;
		const slimeY = slimePosition.y;

		if (
			hero.x < slimeX + slimeHitbox.width &&
			hero.x + hero.hitbox.width > slimeX &&
			hero.y < slimeY + slimeHitbox.height &&
			hero.y + hero.hitbox.height > slimeY
		) {
			hero.inputs.hit.fire();
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
		slimeInputNames.forEach((triggerName) => {
			slimeInputs[triggerName] = getInputByName(slimeMachine, triggerName);
		});

		function renderLoop(time: number) {
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
			slimeMainWrapper.x = slimePosition.x;
			slimeArtboard.draw(renderer);

			//draw hero
			getMovement(elapsedTimeMs);
			heroArtboard.advance(elapsedTimeSec);
			heroMachine.advance(elapsedTimeSec);
			heroMainWrapper.x = hero.x;
			heroMainWrapper.y = hero.y;
			heroArtboard.draw(renderer);
			renderer.save();

			rive.requestAnimationFrame(renderLoop);
		}
		rive.requestAnimationFrame(renderLoop);
	}

	onMount(() => {
		main();
		addEventListener('keydown', (event) => {
			if (event.code === 'KeyW') {
				heroMovement.up = true;
				hero.inputs.up.fire();
				hero.inputs.walking.value = 1;
			} else if (event.code === 'KeyS') {
				heroMovement.down = true;
				hero.inputs.down.fire();
				hero.inputs.walking.value = 1;
			} else if (event.code === 'KeyA') {
				heroMovement.left = true;
				hero.inputs.left.fire();
				hero.inputs.walking.value = 1;
			} else if (event.code === 'KeyD') {
				heroMovement.right = true;
				hero.inputs.right.fire();
				hero.inputs.walking.value = 1;
			} else if (event.code === 'Space') {
				hero.inputs.attack.fire();
			}
		});

		addEventListener('keyup', (event) => {
			if (event.code === 'KeyW') {
				heroMovement.up = false;
			} else if (event.code === 'KeyS') {
				heroMovement.down = false;
			} else if (event.code === 'KeyA') {
				heroMovement.left = false;
			} else if (event.code === 'KeyD') {
				heroMovement.right = false;
			}
			if (Object.values(heroMovement).every((value) => !value)) {
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
		max-height: 1000px;
		max-width: 1000px;
		background-color: #2a3035;
		border-radius: 16px;
	}
</style>
