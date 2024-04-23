<script lang="ts">
	import Rive, { type StateMachineInstance } from '@rive-app/canvas-advanced';
	// @ts-ignore
	import riveWASMResource from '@rive-app/canvas-advanced/rive.wasm';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import GameBro from '../InlineSVGs/GameBro.svelte';
	import Controls from '../InlineSVGs/Controls.svelte';
	import GithubIcon from '../InlineSVGs/GithubIcon.svelte';
	import type { Character, ArtboardData } from './types';
	import {
		getInputByName,
		getCharacterRect,
		getSwordRect,
		setHeroPosition,
		checkSwordHit,
		checkEnemyCollision,
		setLinearMovement,
		applyKnockback,
		isOutOfBounds,
		getRandomSpawnCoordinates
	} from './functions';

	let innerWidth: number;

	let enemies: Character[] = [];
	let hearts: ArtboardData[] = [];
	let wave: number = 1;
	let showingWave: boolean = false;
	let gameStarted: boolean = false;
	let showingWaveTimer: number = 0;

	let lastTime: number;
	let canvasElement: HTMLCanvasElement;
	let isSwingingSword = false;
	let timeSinceSwing = 0;

	let rive: any;
	let renderer: any;
	let file: any;

	const hero: Character = {
		health: 3,
		maxHealth: 3,
		speed: 500,
		hitbox: {
			width: 100,
			height: 100
		},
		x: 500,
		y: 450,
		artboard: null,
		altArtboards: [],
		machine: null,
		inputRefs: {},
		inputs: [
			{ name: 'attack', type: 'trigger' },
			{ name: 'hit', type: 'trigger' },
			{ name: 'walking', type: 'bool' },
			{ name: 'up', type: 'trigger' },
			{ name: 'down', type: 'trigger' },
			{ name: 'left', type: 'trigger' },
			{ name: 'right', type: 'trigger' }
		],
		mainWrapper: null,
		movement: {
			up: false,
			down: false,
			left: false,
			right: false
		},
		orientation: 'down',
		timeSinceLastHit: 2,
		isDead: false,
		timeSinceDeath: 2
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
	const drawHitboxes = false;
	const invincibilityTime = 2;
	const initialSlimeCount = 5;

	function addEnemies() {
		for (let i = 0; i < initialSlimeCount * wave; i++) {
			const coords = getRandomSpawnCoordinates();
			enemies.push({
				health: 3,
				maxHealth: 3,
				speed: 100,
				hitbox: {
					width: 88,
					height: 80
				},
				x: coords.x,
				y: coords.y,
				artboard: null,
				altArtboards: [],
				machine: null,
				inputRefs: {},
				inputs: [
					{
						name: 'attack',
						type: 'trigger'
					},
					{
						name: 'hit',
						type: 'trigger'
					},
					{
						name: 'die',
						type: 'trigger'
					}
				],
				mainWrapper: null,
				movement: {
					up: false,
					down: false,
					left: false,
					right: false
				},
				orientation: 'down',
				timeSinceLastHit: 0,
				isDead: false,
				timeSinceDeath: 0
			});
		}
	}

	async function loadRive() {
		rive = await Rive({
			// Loads Wasm bundle
			locateFile: () => riveWASMResource
		});

		const canvasRef = canvasElement;

		renderer = rive.makeRenderer(canvasRef);

		//TODO: Find out how to get the rive file on page load rather than this fetch
		const bytes = await (await fetch(new Request('rive-files/hero_demo.riv'))).arrayBuffer();
		file = await rive.load(new Uint8Array(bytes));
	}

	function setupUI() {
		for (let i = 0; i < hero.maxHealth; i++) {
			const heartArtboard = file.artboardByName('Heart');
			const heartMainWrapper = heartArtboard.node('main wrapper');
			const heartMachine = new rive.StateMachineInstance(
				heartArtboard.stateMachineByName('State Machine 1'),
				heartArtboard
			);
			heartMainWrapper.scaleX = artboardScale;
			heartMainWrapper.scaleY = artboardScale;
			heartMainWrapper.x = 50 + i * 60;
			heartMainWrapper.y = 50;

			const heartObject: ArtboardData = {
				artboard: heartArtboard,
				machine: heartMachine,
				mainWrapper: heartMainWrapper,
				inputs: [
					{ name: 'fill heart', type: 'trigger' },
					{ name: 'lose heart', type: 'trigger' }
				],
				inputRefs: {}
			};

			heartObject.inputs.forEach((input) => {
				const inputRef = getInputByName(heartObject.machine, input);
				if (!inputRef) return;
				heartObject.inputRefs[input.name] = inputRef;
			});

			hearts.push(heartObject);
		}
	}

	function setupHero() {
		//set up hero
		hero.artboard = file.artboardByName('Hero');
		hero.mainWrapper = hero.artboard?.node('main wrapper') || null;
		if (hero.mainWrapper) {
			hero.mainWrapper.scaleX = artboardScale;
			hero.mainWrapper.scaleY = artboardScale;
		}
		hero.machine = new rive.StateMachineInstance(
			hero?.artboard?.stateMachineByName('State Machine 1'),
			hero.artboard
		);
		hero.inputs.forEach((input) => {
			const inputRef = getInputByName(hero?.machine as StateMachineInstance, input);
			if (!inputRef) return;
			hero.inputRefs[input.name] = inputRef;
		});

		//setup hero splatter artboard
		const heroSplatterArtboard = file.artboardByName('Splatter');
		const heroSplatterMachine = new rive.StateMachineInstance(
			heroSplatterArtboard.stateMachineByName('State Machine 1'),
			heroSplatterArtboard
		);
		const splatterMainWrapper = heroSplatterArtboard.node('main wrapper');
		splatterMainWrapper.scaleX = artboardScale;
		splatterMainWrapper.scaleY = artboardScale;
		hero.altArtboards = [
			...hero.altArtboards,
			{
				artboard: heroSplatterArtboard,
				mainWrapper: splatterMainWrapper,
				machine: heroSplatterMachine
			}
		];
	}

	function setupEnemies() {
		//set up enemies
		enemies.forEach((enemy) => {
			enemy.artboard = file.artboardByName('Slime');
			enemy.mainWrapper = enemy.artboard?.node('main wrapper') || null;
			if (enemy.mainWrapper) {
				enemy.mainWrapper.scaleX = artboardScale;
				enemy.mainWrapper.scaleY = artboardScale;
			}
			enemy.machine = new rive.StateMachineInstance(
				enemy.artboard?.stateMachineByName('State Machine 1'),
				enemy.artboard
			);
			enemy.inputs.forEach((input) => {
				const inputRef = getInputByName(enemy.machine as StateMachineInstance, input);
				if (!inputRef) return;
				enemy.inputRefs[input.name] = inputRef;
			});

			//setup slime splatter artboard
			const splatterArtboard = file.artboardByName('Splatter');
			const splatterMachine = new rive.StateMachineInstance(
				splatterArtboard.stateMachineByName('State Machine 1'),
				splatterArtboard
			);
			const splatterMainWrapper = splatterArtboard.node('main wrapper');
			splatterMainWrapper.scaleX = artboardScale;
			splatterMainWrapper.scaleY = artboardScale;
			enemy.altArtboards = [
				...enemy.altArtboards,
				{ artboard: splatterArtboard, mainWrapper: splatterMainWrapper, machine: splatterMachine }
			];
		});
	}

	function resetGame() {
		enemies = [];
		hero.isDead = false;
		hero.health = hero.maxHealth;
		hero.orientation = 'down';
		hero.x = 500;
		hero.y = 450;
		hearts.forEach((heart) => {
			heart.inputRefs['fill heart'].fire();
		});
		wave = 1;
		setupHero();
		setupEnemies();
	}

	function gameLoop(time: number) {
		if (!lastTime) {
			lastTime = time;
		}
		const elapsedTimeMs = time - lastTime;
		const elapsedTimeSec = elapsedTimeMs / 1000;
		lastTime = time;
		hero.timeSinceLastHit += elapsedTimeSec;

		renderer.clear();

		if (!gameStarted) {
			//draw hero
			hero?.artboard?.advance(elapsedTimeSec);
			hero?.machine?.advance(elapsedTimeSec);
			if (hero.mainWrapper) {
				hero.mainWrapper.x = hero.x;
				hero.mainWrapper.y = hero.y;
			}
			hero?.artboard?.draw(renderer);
			rive.requestAnimationFrame(gameLoop);
			return;
		}

		function playSplatter(character: Character, isHero = false) {
			const splatter = character.altArtboards[0];
			if (isHero) {
				const isBlue = getInputByName(splatter.machine, { name: 'isBlue', type: 'bool' });
				if (isBlue) isBlue.value = 1;
			}
			splatter?.artboard.advance(elapsedTimeSec);
			splatter?.machine.advance(elapsedTimeSec);
			if (splatter?.mainWrapper) {
				splatter.mainWrapper.x = character.x;
				splatter.mainWrapper.y = character.y;
			}
			splatter?.artboard.draw(renderer);
		}

		if (hero.isDead) {
			playSplatter(hero, true);
			hero.timeSinceDeath += elapsedTimeSec;
		}

		//sort enemies to draw them in the correct order
		enemies.sort((a, b) => a.y - b.y);

		//draw enemies
		enemies.forEach((enemy) => {
			setLinearMovement(elapsedTimeSec, enemy, hero);
			enemy?.artboard?.advance(elapsedTimeSec);
			enemy?.machine?.advance(elapsedTimeSec);
			enemy?.artboard?.draw(renderer);
			if (enemy.mainWrapper) {
				enemy.mainWrapper.x = enemy?.x;
				enemy.mainWrapper.y = enemy?.y;
			}
		});

		enemies.forEach((enemy) => {
			//check if enemy is dead
			if (enemy.health <= 0) {
				enemy.isDead = true;
				if (enemy.timeSinceDeath > 2) {
					enemies = enemies.filter((e) => e !== enemy); //TODO: reuse enemies istead of filtering and pushing
				}
				if (enemy.timeSinceDeath > 0) {
					enemy.inputRefs.die.fire();
					playSplatter(enemy);
				}
				enemy.timeSinceDeath += elapsedTimeSec;
			}

			if (!enemy.isDead && hero.timeSinceLastHit > invincibilityTime) {
				if (checkEnemyCollision(hero, enemy)) {
					hero.health -= 1;
					hearts[hero.health]?.inputRefs['lose heart']?.fire();
					enemy.inputRefs.attack.fire();
					if (hero.health <= 0) {
						if (!hero.isDead) {
							hero.timeSinceDeath = 0;
						}
						hero.isDead = true;
						return;
					} else {
						hero.inputRefs.hit.fire();
						hero.timeSinceLastHit = 0;
					}

					//knockback if not out of bounds
					if (!isOutOfBounds(hero, levelBoundaries).x && !isOutOfBounds(hero, levelBoundaries).y) {
						applyKnockback(hero, enemy, 100, levelBoundaries, false);
					}
				}
			}
		});

		//draw hero
		if (!hero.isDead) {
			const boostFactor = hero.timeSinceLastHit < invincibilityTime ? 1.5 : 1;
			setHeroPosition(elapsedTimeSec, hero, levelBoundaries, boostFactor);
			hero.artboard?.advance(elapsedTimeSec);
			hero.machine?.advance(elapsedTimeSec);
			if (hero.mainWrapper) {
				hero.mainWrapper.x = hero.x;
				hero.mainWrapper.y = hero.y;
			}
			hero.artboard?.draw(renderer);
		}

		//draw hearts
		hearts.forEach((heart, index) => {
			heart.artboard.advance(elapsedTimeSec);
			heart.machine.advance(elapsedTimeSec);
			heart.artboard.draw(renderer);
		});

		//draw hitboxes
		if (drawHitboxes) {
			//@ts-ignore
			renderer.fillStyle = 'rgba(255, 0, 0, 0.5)';

			const heroRect = getCharacterRect(hero);
			//@ts-ignore
			renderer.fillRect(heroRect.x, heroRect.y, heroRect.width, heroRect.height);

			enemies.forEach((enemy) => {
				const enemyRect = getCharacterRect(enemy);
				//@ts-ignore
				renderer.fillRect(enemyRect.x, enemyRect.y, enemyRect.width, enemyRect.height);
			});
		}
		renderer.save();

		//check for sword hit
		if (isSwingingSword) {
			timeSinceSwing += elapsedTimeSec;
			if (timeSinceSwing > 0.2) {
				isSwingingSword = false;
				timeSinceSwing = 0;
			}
			enemies.forEach((enemy) => {
				if (enemy.isDead) return;
				if (checkSwordHit(hero, enemy, swordHitbox)) {
					enemy.health -= 1;
					enemy.inputRefs.hit.fire();
					applyKnockback(enemy, hero, 50, levelBoundaries, false);
				}
			});

			if (drawHitboxes) {
				//@ts-ignore
				renderer.fillStyle = 'rgba(255, 0, 0, 0.5)';
				//draw sword hitbox
				const swordRect = getSwordRect(hero, swordHitbox);
				//@ts-ignore
				renderer.fillRect(swordRect.x, swordRect.y, swordRect.width, swordRect.height);
			}
		}

		//show wave announcemnt if all enemies are dead
		if (enemies.every((enemy) => enemy.isDead) && !showingWave) {
			wave += 1;
			showingWave = true;
		}

		// check if wave announcement is over and remove it
		if (showingWave && showingWaveTimer < 5) {
			showingWaveTimer += elapsedTimeSec;
		} else {
			showingWave = false;
			showingWaveTimer = 0;
		}

		//generate next level if all enemies are dead
		if (
			enemies.every((enemy) => enemy.isDead) &&
			enemies.every((enemy) => enemy.timeSinceDeath > 2)
		) {
			addEnemies();
			setupEnemies();
			rive.requestAnimationFrame(gameLoop);
			return;
		}
		renderer.restore();

		rive.requestAnimationFrame(gameLoop);
	}

	function onUp() {
		if (!gameStarted || hero.isDead) return;
		hero.movement.up = true;
		hero.inputRefs.up.fire();
		hero.orientation = 'up';
		hero.inputRefs.walking.value = 1;
	}

	function onDown() {
		if (!gameStarted || hero.isDead) return;
		hero.movement.down = true;
		hero.inputRefs.down.fire();
		hero.orientation = 'down';
		hero.inputRefs.walking.value = 1;
	}

	function onLeft() {
		if (!gameStarted || hero.isDead) return;
		hero.movement.left = true;
		hero.inputRefs.left.fire();
		hero.orientation = 'left';
		hero.inputRefs.walking.value = 1;
	}

	function onRight() {
		if (!gameStarted || hero.isDead) return;
		hero.movement.right = true;
		hero.inputRefs.right.fire();
		hero.orientation = 'right';
		hero.inputRefs.walking.value = 1;
	}

	function swing() {
		if (timeSinceSwing > 0) return;
		hero.inputRefs.attack.fire();
		isSwingingSword = true;
		timeSinceSwing = 0;
	}

	function onSwing() {
		if (!gameStarted || hero.isDead) {
			gameStarted = true;
			hero.inputRefs.attack.fire();
			showingWave = true;
			if (hero.isDead && hero.timeSinceDeath >= 2) {
				resetGame();
			}
			return;
		}
		swing();
	}

	function stop() {
		hero.movement.up = false;
		hero.movement.down = false;
		hero.movement.left = false;
		hero.movement.right = false;
		if (hero.inputRefs.walking) {
			hero.inputRefs.walking.value = 0;
		}
	}

	onMount(() => {
		addEnemies();
		loadRive().then(() => {
			setupUI();
			setupHero();
			setupEnemies();
			rive.requestAnimationFrame(gameLoop); //TODO: run game loop from worker
		});
		addEventListener('keydown', (event) => {
			if (event.code === 'KeyW') {
				onUp();
			} else if (event.code === 'KeyS') {
				onDown();
			} else if (event.code === 'KeyA') {
				onLeft();
			} else if (event.code === 'KeyD') {
				onRight();
			} else if (event.code === 'Space') {
				onSwing();
			}
		});

		addEventListener('keyup', (event) => {
			if (!gameStarted) return;
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
				if (hero.inputRefs.walking) {
					hero.inputRefs.walking.value = 0;
				}
			}
		});
	});
</script>

<svelte:window bind:innerWidth on:touchend|preventDefault />

<!-- TODO: Add all this DOM inside Rive canvas -->
<div class="wrapper">
	<div class="game-window">
		<canvas height="1000" width="1000" bind:this={canvasElement}></canvas>
		{#if showingWave}
			<div transition:fade class="wave-counter">
				<span>Wave {wave}</span>
			</div>
		{/if}
		{#if !gameStarted || hero.isDead}
			<div class="start-game-menu">
				{#if hero.isDead && hero.timeSinceDeath >= 2}
					<span in:fade>GAME OVER</span>
					<span in:fade>Press {innerWidth < 850 ? 'A' : 'SPACE'} to play again</span>
				{:else if !hero.isDead}
					<span>Press {innerWidth < 850 ? 'A' : 'SPACE'} to start</span>
					{#if innerWidth > 850}
						<div class="controls-wrapper">
							<Controls />
						</div>
					{/if}
				{/if}
			</div>
		{/if}
		<div class="game-bro-wrapper">
			<GameBro />
		</div>
		<a href="https://github.com/plitarko/rive-slime-survival" class="github-link" target="_blank">
			<GithubIcon />
		</a>
		<div class="d-pad">
			<div class="d-pad-button"></div>
			<div
				class="d-pad-button"
				on:pointerdown={() => {
					stop();
					onUp();
				}}
				on:pointerup={stop}
				on:pointerleave={stop}
			></div>
			<div class="d-pad-button"></div>
			<div
				class="d-pad-button"
				on:pointerdown={() => {
					stop();
					onLeft();
				}}
				on:pointerup={stop}
				on:pointerleave={stop}
			></div>
			<div class="d-pad-button"></div>
			<div
				class="d-pad-button"
				on:pointerdown={() => {
					stop();
					onRight();
				}}
				on:pointerup={stop}
				on:pointerleave={stop}
			></div>
			<div class="d-pad-button"></div>
			<div
				class="d-pad-button"
				on:pointerdown={() => {
					stop();
					onDown();
				}}
				on:pointerup={stop}
				on:pointerleave={stop}
			></div>
			<div class="d-pad-button"></div>
		</div>
		<div class="a-button" on:pointerdown={onSwing}></div>
	</div>
</div>

<style lang="postcss">
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
		background: linear-gradient(0deg, #181d20 0%, rgb(40, 46, 51) 100%);
		@media screen and (max-width: 850px) {
			display: block;
			padding-left: 19.5vw;
		}
	}

	.game-window {
		position: relative;
		height: calc(min(100vh, 100vw) - 30px);
		width: calc(min(100vw, 100vh) - 30px);
		max-height: 500px;
		max-width: 500px;
		margin-top: -100px;
		@media screen and (max-height: 750px) {
			margin-top: unset;
		}
		@media screen and (max-width: 850px) {
			height: calc(min(60vh, 60vw));
			width: calc(min(60vw, 60vh));
			margin-top: 23%;
		}
	}

	canvas {
		height: 100%;
		width: 100%;
		background-color: #2a3035;
		background: linear-gradient(180deg, #1e262b 0%, rgb(39, 46, 53) 100%);
	}

	.game-bro-wrapper {
		position: absolute;
		top: -26.8%;
		left: -81.7%;
		height: 266%;
		width: 266%;
		opacity: 0.5;
	}

	.start-game-menu {
		position: relative;
		margin-top: -100%;
		padding: 6px;
		padding-top: 50%;
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-size: 24px;
		color: #576c7b;
		gap: 10px;
		text-shadow: 0px 0px 10px #00000067;

		@media screen and (max-width: 850px) {
			font-size: 16px;
		}
	}

	.controls-wrapper {
		height: 40%;
		width: 40%;
	}

	.wave-counter {
		position: relative;
		margin-top: -140%;
		padding: 6px;
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-size: 24px;
		color: #576c7b;
		text-shadow: 0px 0px 10px #00000067;

		@media screen and (max-width: 850px) {
			font-size: 16px;
		}
	}

	.github-link {
		position: absolute;
		bottom: -11.8%;
		right: 0;
		height: 9%;
		width: 9%;
		color: rgb(48, 55, 61);

		&:hover {
			color: white;
		}
	}

	.d-pad {
		position: absolute;
		height: 40%;
		width: 40%;
		top: 135.6%;
		left: -14.6%;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		user-select: none;

		& .d-pad-button {
			height: 100%;
			width: 100%;
			user-select: none;
		}
	}

	.a-button {
		position: absolute;
		top: 140.8%;
		right: -19.5%;
		height: 22%;
		width: 22%;
		user-select: none;
	}
</style>
