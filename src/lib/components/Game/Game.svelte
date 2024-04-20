<script lang="ts">
	import RiveCanvas, { type StateMachineInstance } from '@rive-app/canvas-advanced';
	import riveWASMResource from '@rive-app/canvas-advanced/rive.wasm';
	import { onMount } from 'svelte';
	import GameBro from './GameBro.svelte';
	import type { Character } from './types';
	import {
		getInputByName,
		getCharacterRect,
		getSwordRect,
		setHeroMovement,
		checkSwordHit,
		checkEnemyCollision,
		setLinearMovement,
		applyKnockback,
		isOutOfBounds
	} from './functions';

	const drawHitboxes = false;
	let enemies: Character[] = [];
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
		altArtboards: [],
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
		orientation: 'down',
		isDead: false,
		timeSinceDeath: 0
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
	const initialSlimeCount = 10;

	for (let i = 0; i < initialSlimeCount; i++) {
		enemies.push({
			health: 3,
			speed: 100,
			hitbox: {
				width: 88,
				height: 80
			},
			x: 1000 * Math.random(),
			y: 1000 * Math.random(),
			artboard: null,
			altArtboards: [],
			machine: null,
			inputs: {},
			inputNames: ['attack', 'hit', 'die'],
			mainWrapper: null,
			movement: {
				up: false,
				down: false,
				left: false,
				right: false
			},
			orientation: 'down',
			isDead: false,
			timeSinceDeath: 0
		});
	}

	let lastTime: number;
	let canvasElement: HTMLCanvasElement;
	let isSwingingSword = false;
	let timeSinceSwing = 0;

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

		//setup enemies
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

			//setup slime splatter
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

		function gameLoop(time: number) {
			if (!lastTime) {
				lastTime = time;
			}
			const elapsedTimeMs = time - lastTime;
			const elapsedTimeSec = elapsedTimeMs / 1000;
			lastTime = time;

			renderer.clear();

			//sort enemies
			enemies = [...enemies.sort((a, b) => a.y - b.y)];

			//draw enemies
			enemies.forEach((enemy) => {
				setLinearMovement(elapsedTimeSec, enemy, hero);
				enemy?.artboard?.advance(elapsedTimeSec);
				enemy?.machine?.advance(elapsedTimeSec);
				enemy?.artboard?.draw(renderer);
				enemy.mainWrapper.x = enemy.x;
				enemy.mainWrapper.y = enemy.y;
			});

			//check for collisions with enemies
			enemies.forEach((enemy) => {
				//check if enemy is dead
				if (enemy.health <= 0) {
					enemy.isDead = true;
					if (enemy.timeSinceDeath > 2) {
						enemies = enemies.filter((e) => e !== enemy);
					}
					if (enemy.timeSinceDeath > 0) {
						enemy.inputs.die.fire();
						playSplatter(enemy);
					}
					enemy.timeSinceDeath += elapsedTimeSec;
				}

				if (!enemy.isDead) {
					if (checkEnemyCollision(hero, enemy)) {
						hero.inputs.hit.fire();
						enemy.inputs.attack.fire();

						//knockback if not out of bounds
						if (
							!isOutOfBounds(hero, levelBoundaries).x &&
							!isOutOfBounds(hero, levelBoundaries).y
						) {
							applyKnockback(hero, enemy, 100, levelBoundaries, false);
						}
					}
				}

				function playSplatter(enemy: Character) {
					const splatter = enemy.altArtboards[0];
					splatter?.artboard.advance(elapsedTimeSec);
					splatter?.machine.advance(elapsedTimeSec);
					if (splatter?.mainWrapper) {
						splatter.mainWrapper.x = enemy.x;
						splatter.mainWrapper.y = enemy.y;
					}
					splatter?.artboard.draw(renderer);
				}
			});

			//draw hero
			setHeroMovement(elapsedTimeSec, hero, levelBoundaries);
			heroArtboard.advance(elapsedTimeSec);
			heroMachine.advance(elapsedTimeSec);
			heroMainWrapper.x = hero.x;
			heroMainWrapper.y = hero.y;
			heroArtboard.draw(renderer);
			renderer.save();

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
						enemy.inputs.hit.fire();
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
				if (hero.inputs.walking) {
					hero.inputs.walking.value = 0;
				}
			}
		});
	});
</script>

<div class="wrapper">
	<div class="game-window">
		<canvas height="1000" width="1000" bind:this={canvasElement}></canvas>
		<div class="game-bro-wrapper">
			<GameBro />
		</div>
	</div>
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
		background: linear-gradient(180deg, rgb(40, 46, 51) 0%, #181d20 100%);
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
</style>
