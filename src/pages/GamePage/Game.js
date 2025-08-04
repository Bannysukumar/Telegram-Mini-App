import React, { useRef, useEffect, useState, useCallback } from "react";
import { ref, get, update } from "firebase/database";
import { database } from "../../services/FirebaseConfig";
import { useTelegram } from "../../reactContext/TelegramContext.js";
import {addHistoryLog} from "../../services/addHistory.js"
import ObjectPool from "./ObjectPool.js";

// Define updateGameScoresWrapper as a function declaration so it's hoisted.
async function updateGameScoresWrapper(currentGameScore, userId) {
  
  const userRef = ref(database, `users/${userId}/Score`);
  try {
    const snapshot = await get(userRef);
    let updates = {};
    const userData = snapshot.val();
    if (snapshot.exists()) {
      updates.game_score = (userData.game_score || 0) + currentGameScore;
      updates.total_score = (userData.total_score || 0) + currentGameScore;
      const currentHighScore = userData.game_highest_score || 0;
      if (currentGameScore > currentHighScore) {
        updates.game_highest_score = currentGameScore;
      }
    } else {
      updates = {
        game_score: currentGameScore,
        game_highest_score: currentGameScore,
        total_score:userData.total_score
      };
    }
    await update(userRef, updates);
    const textData ={
            action: 'Game Points Added',
            points: currentGameScore,
            type: 'game',
      }
    
    addHistoryLog(userId,textData)    
    console.log("Scores updated successfully in Firebase.");
  } catch (error) {
    console.error("Error updating scores in Firebase:", error);
  }
}

const Game = ({ onGameOver, startGame }) => {
  const { user } = useTelegram();
  const userId = user.id;
  const canvasRef = useRef(null);
  const backgroundMusicRef = useRef(null);
  const sliceSoundRef = useRef(null);
  const bombSoundRef = useRef(null);
  const goldenCoinIntervalRef = useRef(null);
  
  // Cache DOM elements for better performance
  const scoreElementRef = useRef(null);
  const timerElementRef = useRef(null);
  const highScoreElementRef = useRef(null);
  
  // Initialize mute state from localStorage with reduced polling
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem("gameMuted") === "true");

  // Optimized localStorage polling - reduced frequency and added cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      const storedMuted = localStorage.getItem("gameMuted") === "true";
      if (storedMuted !== isMuted) {
      setIsMuted(storedMuted);
      }
    }, 1000); // Reduced from 500ms to 1000ms
    return () => clearInterval(interval);
  }, [isMuted]);

  // Other mutable refs for game state.
  const fruitsRef = useRef([]);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const gameLoopRef = useRef(null);
  const spawnIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const highScoreRef = useRef(0);
  // Game lasts 45 seconds.
  const timeRemainingRef = useRef(45);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const slashPointsRef = useRef([]);
  const shineParticlesRef = useRef([]);
  const slicedFruitParticlesRef = useRef([]);
  const floatingTextsRef = useRef([]);
  
  // Performance optimization: Cache canvas context
  const canvasContextRef = useRef(null);
  
  // Performance optimization: Particle limits
  const MAX_PARTICLES = 80; // Reduced from 100
  const MAX_SHINE_PARTICLES = 40; // Reduced from 50
  const MAX_FLOATING_TEXTS = 15; // Reduced from 20
  const MAX_FRUITS = 20; // Increased limit for more difficulty
  const FRAME_RATE = 60; // Increased for more responsive gameplay
  
  // Performance monitoring
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsRef = useRef(0);
  
  // Object pools for better performance (will be initialized after class definitions)
  const shineParticlePool = useRef(null);
  const slicedParticlePool = useRef(null);
  const floatingTextPool = useRef(null);

  // Helper function to pick a bonus fruit emoji (allowed fruits only).
  const getBonusEmoji = useCallback(() => {
    const bonusFruits = [
      { emoji: "🍎", weight: 30 },
      { emoji: "🍊", weight: 25 },
      { emoji: "🍇", weight: 20 },
      { emoji: "🍓", weight: 15 },
      { emoji: "🥭", weight: 10 },
    ];
    const total = bonusFruits.reduce((sum, item) => sum + item.weight, 0);
    let rand = Math.random() * total;
    for (const item of bonusFruits) {
      if (rand < item.weight) return item.emoji;
      rand -= item.weight;
    }
    return "🍎";
  }, []);

  // ─── CLASS DEFINITIONS ───────────────────────────────────────────
  class Fruit {
    // The second parameter isBonus defaults to false.
    constructor(isGolden = false, isBonus = false) {
      this.isGolden = isGolden;
      this.isBonus = isBonus;
      this.size = isGolden ? 150 : 200;
      this.sliceRadius = 35; // Balanced size for accurate detection
      this.resetPosition();
      if (isGolden) {
        this.emoji = "🪙";
        this.points = 0;
      } else if (isBonus) {
        // For bonus fruits, override emoji with one from allowed set.
        this.emoji = getBonusEmoji();
        const pointsMap = {
          "🍎": 1,
          "🍊": 2,
          "🍇": 4,
          "🍓": 5,
          "🥭": 3,
        };
        this.points = pointsMap[this.emoji] || 1;
      } else {
        this.emoji = this.getRandomEmoji();
        this.points = this.getPoints();
      }
      this.isSliced = false;
    }
    resetPosition() {
      const canvas = canvasRef.current;
      if (this.isBonus) {
        // Bonus fruits appear anywhere on the canvas.
        this.x = Math.random() * (canvas.width - this.size);
        this.y = Math.random() * (canvas.height - this.size);
        this.velocityX = 0;
        this.velocityY = 0;
      } else {
        // Regular fruit positioning.
        const headerHeight = 120;
        const vh = (window.innerHeight - headerHeight) / 120;
        const allowedTop = headerHeight + 10 * vh;
        const allowedBottom = window.innerHeight - 10 * vh;
        this.y = allowedTop + Math.random() * (allowedBottom - allowedTop - this.size);
        this.zone = Math.random() < 0.5 ? "left" : "right";
        if (this.zone === "left") {
          this.x = -this.size / 2;
          this.velocityX = Math.random() * 3 + 4; // Increased velocity
          this.velocityY = -(Math.random() * 4 + 5); // Increased velocity
        } else {
          this.x = canvas.width - this.size / 2;
          this.velocityX = -(Math.random() * 5 + 5); // Increased velocity
          this.velocityY = -(Math.random() * 4 + 8); // Increased velocity
        }
      }
    }
    getRandomEmoji() {
      const emojis = [
        { emoji: "🍎", weight: 25 },
        { emoji: "🍊", weight: 20 },
        { emoji: "🍇", weight: 15 },
        { emoji: "🍓", weight: 12 },
        { emoji: "💣", weight: 10 }, // Increased bomb frequency
        { emoji: "❄️", weight: 8 }, // Increased ice frequency
        { emoji: "🥭", weight: 10 },
      ];
      const totalWeight = emojis.reduce((sum, item) => sum + item.weight, 0);
      let rand = Math.random() * totalWeight;
      for (const item of emojis) {
        if (rand < item.weight) return item.emoji;
        rand -= item.weight;
      }
      return "🍎";
    }
    getPoints() {
      const pointsMap = {
        "🍎": 1,
        "🍊": 2,
        "🍇": 4,
        "🍓": 5,
        "💣": -5,
        "❄️": 2,
        "🥭": 3,
      };
      return pointsMap[this.emoji] || 1;
    }
    update() {
      // If not sliced and not in bonus mode, update positions.
      if (!this.isSliced && !this.isBonus) {
        this.velocityY += 0.3; // Increased gravity for faster falling
        this.x += this.velocityX;
        this.y += this.velocityY;
      }
      // Remove fruit if it goes off-screen.
      if (
        this.x > canvasRef.current.width ||
        this.x + this.size < 0 ||
        this.y > canvasRef.current.height
      ) {
        return true;
      }
      return false;
    }
    draw(ctx) {
      if (this.isSliced) return;
      ctx.font = "80px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.emoji, this.x + this.size / 2, this.y + this.size / 2);
    }
    checkSlice(x1, y1, x2, y2) {
      if (this.isSliced) return false;
      
      // More precise collision detection
      const centerX = this.x + this.size / 2;
      const centerY = this.y + this.size / 2;
      
      // Check center point with smaller radius
      const centerDist = this.pointToLineDistance(centerX, centerY, x1, y1, x2, y2);
      if (centerDist < this.sliceRadius * 0.6) return true; // Reduced from full radius
      
      // Check corner points with much smaller radius
      const corners = [
        { x: this.x, y: this.y }, // top-left
        { x: this.x + this.size, y: this.y }, // top-right
        { x: this.x, y: this.y + this.size }, // bottom-left
        { x: this.x + this.size, y: this.y + this.size }, // bottom-right
        { x: centerX, y: this.y }, // top-center
        { x: centerX, y: this.y + this.size }, // bottom-center
        { x: this.x, y: centerY }, // left-center
        { x: this.x + this.size, y: centerY }, // right-center
      ];
      
      for (const corner of corners) {
        const dist = this.pointToLineDistance(corner.x, corner.y, x1, y1, x2, y2);
        if (dist < this.sliceRadius * 0.4) { // Much smaller radius for corners
          return true;
        }
      }
      
      // Only check line intersection if the slice line is close to the fruit
      const fruitLeft = this.x;
      const fruitRight = this.x + this.size;
      const fruitTop = this.y;
      const fruitBottom = this.y + this.size;
      
      // Check if slice line endpoints are near the fruit
      const dist1 = Math.sqrt((x1 - centerX) ** 2 + (y1 - centerY) ** 2);
      const dist2 = Math.sqrt((x2 - centerX) ** 2 + (y2 - centerY) ** 2);
      
      if (dist1 < this.sliceRadius * 1.2 || dist2 < this.sliceRadius * 1.2) {
        // Check if any part of the slice line intersects with the fruit
        const lineSegments = [
          { x1: fruitLeft, y1: fruitTop, x2: fruitRight, y2: fruitTop }, // top edge
          { x1: fruitRight, y1: fruitTop, x2: fruitRight, y2: fruitBottom }, // right edge
          { x1: fruitRight, y1: fruitBottom, x2: fruitLeft, y2: fruitBottom }, // bottom edge
          { x1: fruitLeft, y1: fruitBottom, x2: fruitLeft, y2: fruitTop }, // left edge
        ];
        
        for (const segment of lineSegments) {
          if (this.linesIntersect(x1, y1, x2, y2, segment.x1, segment.y1, segment.x2, segment.y2)) {
            return true;
          }
        }
      }
      
      return false;
    }
    pointToLineDistance(px, py, x1, y1, x2, y2) {
      const A = px - x1;
      const B = py - y1;
      const C = x2 - x1;
      const D = y2 - y1;
      const dot = A * C + B * D;
      const len_sq = C * C + D * D;
      let param = -1;
      if (len_sq !== 0) param = dot / len_sq;
      let xx, yy;
      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }
      const dx = px - xx;
      const dy = py - yy;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
      // Calculate the direction vectors
      const uA = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
      const uB = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
      
      // Check if the lines intersect
      return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
    }
  }

  class ShineParticle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 10 + 5;
      this.speedX = Math.random() * 3 - 1.5;
      this.speedY = Math.random() * 3 - 1.5;
      this.life = 30;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.life--;
    }
    draw(ctx) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.life / 30})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class SlicedFruitParticle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 5 + 2;
      this.speedX = Math.random() * 6 - 3;
      this.speedY = -Math.random() * 15;
      this.gravity = 0.5;
      this.color = color;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.speedY += this.gravity;
    }
    draw(ctx) {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class FloatingText {
    constructor(x, y, text, color) {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.life = 60;
      this.opacity = 1;
    }
    update() {
      this.y -= 0.5;
      this.life--;
      this.opacity = this.life / 60;
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;
      ctx.font = "30px Arial";
      ctx.textAlign = "center";
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  // Initialize object pools after class definitions
  useEffect(() => {
    shineParticlePool.current = new ObjectPool(
      () => new ShineParticle(0, 0),
      (particle) => {
        particle.x = 0;
        particle.y = 0;
        particle.life = 30;
      },
      20
    );
    
    slicedParticlePool.current = new ObjectPool(
      () => new SlicedFruitParticle(0, 0, "#ffffff"),
      (particle) => {
        particle.x = 0;
        particle.y = 0;
        particle.speedX = 0;
        particle.speedY = 0;
      },
      30
    );
    
    floatingTextPool.current = new ObjectPool(
      () => new FloatingText(0, 0, "", "#ffffff"),
      (text) => {
        text.x = 0;
        text.y = 0;
        text.life = 60;
        text.opacity = 1;
      },
      10
    );
  }, []);

  // ─── GAME FUNCTIONS ───────────────────────────────────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Cache the context after resize
      canvasContextRef.current = canvas.getContext("2d");
    }
  }, []);

  // Optimized function to update UI elements
  const updateUI = useCallback((score, timer, highScore) => {
    if (scoreElementRef.current) {
      scoreElementRef.current.textContent = `Score: ${score}`;
    }
    if (timerElementRef.current) {
      timerElementRef.current.textContent = `Time: ${timer}`;
    }
    if (highScoreElementRef.current) {
      highScoreElementRef.current.textContent = `High: ${highScore}`;
    }
  }, []);

  // When a golden coin is sliced, trigger bonus mode:
  // Spawn bonus fruits (only allowed fruits) across the screen,
  // and display a countdown timer that decrements every second.
  const bonusEffect = useCallback(() => {
    // Pause normal fruit spawning.
    clearInterval(spawnIntervalRef.current);
    const count = Math.floor(Math.random() * 6) + 20; // Reduced from 40-50 to 20-25 bonus fruits.
    for (let i = 0; i < count; i++) {
      let bonusFruit = new Fruit(false, true);
      // Override emoji with bonus fruit emoji.
      bonusFruit.emoji = getBonusEmoji();
      const pointsMap = {
        "🍎": 1,
        "🍊": 2,
        "🍇": 4,
        "🍓": 5,
        "🥭": 3,
      };
      bonusFruit.points = pointsMap[bonusFruit.emoji] || 1;
      fruitsRef.current.push(bonusFruit);
    }
    
    // Create and display the countdown timer
    let timeLeft = 5;
    const timerElement = document.createElement("div");
    timerElement.textContent = `${timeLeft}`;
    timerElement.style.position = "fixed";
    timerElement.style.top = "50%";
    timerElement.opacity = 0.1;
    timerElement.style.left = "50%";
    timerElement.style.transform = "translate(-50%, -50%)";
    timerElement.style.fontSize = "80px";
    timerElement.style.fontWeight = "bold";
    timerElement.style.color = "red";
    timerElement.style.textShadow = "0 0 10px rgba(237, 140, 98, 0.8)";
    timerElement.style.zIndex = "1000";
    timerElement.style.pointerEvents = "none";
    document.body.appendChild(timerElement);
    
    // Update the timer every second
    const countdownInterval = setInterval(() => {
      timeLeft--;
      timerElement.textContent = `${timeLeft}`;
      
      // Add a pulse animation effect
      timerElement.style.animation = "none";
      void timerElement.offsetWidth; // Trigger reflow
      timerElement.style.animation = "pulse 1s";
    }, 1000);
    
    // After 5 seconds, remove bonus fruits, timer element, and resume normal spawn.
    setTimeout(() => {
      clearInterval(countdownInterval);
      if (document.body.contains(timerElement)) {
        document.body.removeChild(timerElement);
      }
      fruitsRef.current = fruitsRef.current.filter((fruit) => !fruit.isBonus);
      spawnIntervalRef.current = setInterval(spawnFruit, 1200); // Faster spawning for increased difficulty
    }, 5000);
  }, [getBonusEmoji]);

  // endGame is defined as an async function.
  const endGame = useCallback(async () => {
    gameOverRef.current = true;
    clearInterval(gameLoopRef.current);
    clearInterval(spawnIntervalRef.current);
    clearInterval(timerIntervalRef.current);
    clearInterval(goldenCoinIntervalRef.current);
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
    }
    
    // Clean up object pools
    if (shineParticlePool.current) shineParticlePool.current.releaseAll();
    if (slicedParticlePool.current) slicedParticlePool.current.releaseAll();
    if (floatingTextPool.current) floatingTextPool.current.releaseAll();
    
    await updateGameScoresWrapper(scoreRef.current, userId);
    if (onGameOver) onGameOver(scoreRef.current, highScoreRef.current);
  }, [userId, onGameOver]);

  const startTimer = useCallback(() => {
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      if (!gameOverRef.current) {
        timeRemainingRef.current--;
        updateUI(scoreRef.current, timeRemainingRef.current, highScoreRef.current);
        if (timeRemainingRef.current <= 0) {
          clearInterval(timerIntervalRef.current);
          endGame();
        }
      }
    }, 1000);
  }, [updateUI, endGame]);

  // Optimized updateGame function with better performance
  const updateGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvasContextRef.current || canvas.getContext("2d");
    if (!ctx) return;
    
    // Performance monitoring
    frameCountRef.current++;
    const currentTime = performance.now();
    if (currentTime - lastTimeRef.current >= 1000) {
      fpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      lastTimeRef.current = currentTime;
      
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`FPS: ${fpsRef.current} | Fruits: ${fruitsRef.current.length} | Particles: ${shineParticlesRef.current.length + slicedFruitParticlesRef.current.length}`);
      }
    }
    
    // Clear canvas efficiently
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Limit fruits for better performance
    if (fruitsRef.current.length > MAX_FRUITS) {
      fruitsRef.current.splice(0, fruitsRef.current.length - MAX_FRUITS);
    }

    // Optimized particle updates with limits
    // Update shine particles with limit
    for (let i = shineParticlesRef.current.length - 1; i >= 0; i--) {
      shineParticlesRef.current[i].update();
      shineParticlesRef.current[i].draw(ctx);
      if (shineParticlesRef.current[i].life <= 0) {
        if (shineParticlePool.current) {
          shineParticlePool.current.release(shineParticlesRef.current[i]);
        }
        shineParticlesRef.current.splice(i, 1);
      }
    }
    
    // Limit shine particles
    if (shineParticlesRef.current.length > MAX_SHINE_PARTICLES) {
      shineParticlesRef.current.splice(0, shineParticlesRef.current.length - MAX_SHINE_PARTICLES);
    }
    
    // Update sliced fruit particles with limit
    for (let i = slicedFruitParticlesRef.current.length - 1; i >= 0; i--) {
      slicedFruitParticlesRef.current[i].update();
      slicedFruitParticlesRef.current[i].draw(ctx);
      if (slicedFruitParticlesRef.current[i].y > canvas.height) {
        if (slicedParticlePool.current) {
          slicedParticlePool.current.release(slicedFruitParticlesRef.current[i]);
        }
        slicedFruitParticlesRef.current.splice(i, 1);
      }
    }
    
    // Limit total particles
    if (slicedFruitParticlesRef.current.length > MAX_PARTICLES) {
      slicedFruitParticlesRef.current.splice(0, slicedFruitParticlesRef.current.length - MAX_PARTICLES);
    }
    
    // Update floating texts with limit
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
      floatingTextsRef.current[i].update();
      floatingTextsRef.current[i].draw(ctx);
      if (floatingTextsRef.current[i].life <= 0) {
        if (floatingTextPool.current) {
          floatingTextPool.current.release(floatingTextsRef.current[i]);
        }
        floatingTextsRef.current.splice(i, 1);
      }
    }
    
    // Limit floating texts
    if (floatingTextsRef.current.length > MAX_FLOATING_TEXTS) {
      floatingTextsRef.current.splice(0, floatingTextsRef.current.length - MAX_FLOATING_TEXTS);
    }
    
    // Update fruits with optimized array operations
    const fruitsToRemove = [];
    for (let i = fruitsRef.current.length - 1; i >= 0; i--) {
      const fruit = fruitsRef.current[i];
      // During bonus mode (when bonus fruits are on screen), bonus fruits are static.
      if (fruit.isBonus) {
        fruit.draw(ctx);
      } else {
        if (fruit.update()) {
          fruitsToRemove.push(i);
        } else {
          fruit.draw(ctx);
        }
      }
    }
    
    // Remove fruits in reverse order to maintain indices
    for (let i = fruitsToRemove.length - 1; i >= 0; i--) {
      fruitsRef.current.splice(fruitsToRemove[i], 1);
    }
    
    // Draw slash line only if there are points
    if (slashPointsRef.current.length > 1) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(slashPointsRef.current[0].x, slashPointsRef.current[0].y);
      for (let i = 1; i < slashPointsRef.current.length; i++) {
        ctx.lineTo(slashPointsRef.current[i].x, slashPointsRef.current[i].y);
      }
      ctx.stroke();
    }
  }, []);

  const fetchHighScoreWrapper = useCallback(async () => {
    const userRef = ref(database, `users/${userId}/Score`);
    try {
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        highScoreRef.current = userData.game_highest_score || 0;
        updateUI(scoreRef.current, timeRemainingRef.current, highScoreRef.current);
      } else {
        highScoreRef.current = 0;
        updateUI(scoreRef.current, timeRemainingRef.current, 0);
      }
    } catch (error) {
      console.error("Error fetching high score from Firebase:", error);
      highScoreRef.current = 0;
      updateUI(scoreRef.current, timeRemainingRef.current, 0);
    }
  }, [userId, updateUI]);

  const spawnFruit = useCallback(() => {
    if (!gameOverRef.current && fruitsRef.current.length < MAX_FRUITS) {
      const fruitCounts = [4, 4, 3, 3, 5]; // Increased fruit counts for more difficulty
      const count = fruitCounts[Math.floor(Math.random() * fruitCounts.length)];
      for (let i = 0; i < count; i++) {
        if (fruitsRef.current.length < MAX_FRUITS) {
        fruitsRef.current.push(new Fruit());
      }
    }
    }
  }, []);

  const spawnGoldenCoin = useCallback(() => {
    if (!gameOverRef.current) {
      // Only add a golden coin if one isn't already onscreen.
      const coinExists = fruitsRef.current.some(
        (fruit) => fruit.emoji === "🪙" && !fruit.isSliced
      );
      if (!coinExists) {
        fruitsRef.current.push(new Fruit(true));
      }
    }
  }, []);

  // When slicing occurs, check each fruit.
  const handleSlice = useCallback((points) => {
    if (gameOverRef.current || points.length < 2) return;
    
    let sliceHappened = false;
    
    // Check multiple line segments along the slice path for better detection
    const segmentsToCheck = Math.min(points.length - 1, 2); // Reduced to 2 segments
    const step = Math.max(1, Math.floor((points.length - 1) / segmentsToCheck));
    
    for (let i = 0; i < points.length - 1; i += step) {
      const x1 = points[i].x;
      const y1 = points[i].y;
      const x2 = points[i + 1].x;
      const y2 = points[i + 1].y;
      
    fruitsRef.current.forEach((fruit) => {
      if (!fruit.isSliced && fruit.checkSlice(x1, y1, x2, y2)) {
        fruit.isSliced = true;
        // If it's a golden coin, trigger bonus mode.
        if (fruit.emoji === "🪙") {
          bonusEffect();
        } else {
          // For regular (non-golden) fruits, update score and show effects.
          scoreRef.current += fruit.points;
            updateUI(scoreRef.current, timeRemainingRef.current, highScoreRef.current);
            
                      // Limit particle creation using object pool
          const particleCount = Math.min(3, MAX_SHINE_PARTICLES - shineParticlesRef.current.length);
          for (let j = 0; j < particleCount; j++) {
            if (shineParticlePool.current) {
              const particle = shineParticlePool.current.get();
              particle.x = fruit.x + fruit.size / 2;
              particle.y = fruit.y + fruit.size / 2;
              shineParticlesRef.current.push(particle);
          }
          }
            
          const fruitColors = {
            "🍎": "#ff0000",
            "🍊": "#ffa500",
            "🍇": "#800080",
            "🍓": "#ff0000",
            "💣": "#000000",
            "❄️": "#ffffff",
            "🥭": "#ffa500",
          };
          const color = fruitColors[fruit.emoji] || "#ffffff";
            
            // Limit sliced fruit particles using object pool
            const slicedParticleCount = Math.min(6, MAX_PARTICLES - slicedFruitParticlesRef.current.length);
            for (let j = 0; j < slicedParticleCount; j++) {
              if (slicedParticlePool.current) {
                const particle = slicedParticlePool.current.get();
                particle.x = fruit.x + fruit.size / 2;
                particle.y = fruit.y + fruit.size / 2;
                particle.color = color;
                slicedFruitParticlesRef.current.push(particle);
          }
            }
            
            // Limit floating texts using object pool
            if (floatingTextsRef.current.length < MAX_FLOATING_TEXTS && floatingTextPool.current) {
              const text = floatingTextPool.current.get();
              text.x = fruit.x + fruit.size / 2;
              text.y = fruit.y + fruit.size / 2;
              text.text = (fruit.points > 0 ? "+" : "") + fruit.points;
              text.color = color;
              floatingTextsRef.current.push(text);
            }
            
          if (fruit.emoji === "💣") {
            bombEffect();
          } else if (fruit.emoji === "❄️") {
            iceEffect();
          }
        }
        sliceHappened = true;
      }
    });
    }
    
    if (sliceHappened) {
      if (sliceSoundRef.current) {
        sliceSoundRef.current.currentTime = 0;
        sliceSoundRef.current.play().catch((err) => console.error(err));
      }
    } else {
      slashPointsRef.current = [points[points.length - 1]];
    }
  }, [bonusEffect, updateUI]);

  const iceEffect = useCallback(() => {
    clearInterval(timerIntervalRef.current);
    const scoreEl = scoreElementRef.current;
    const highScoreEl = highScoreElementRef.current;
    if (scoreEl) {
    scoreEl.style.transition = "box-shadow 0.5s ease";
    scoreEl.style.boxShadow = "0 0 20px 10px rgba(0, 191, 255, 0.8)";
    }
    if (highScoreEl) {
      highScoreEl.style.transition = "box-shadow 0.5s ease";
    highScoreEl.style.boxShadow = "0 0 20px 10px rgba(0, 191, 255, 0.8)";
    }
    document.documentElement.style.setProperty("--background-color", "#b3e5fc");

    let iceText = document.createElement("div");
    iceText.textContent = "❄️ Time Frozen! 🥶";
    iceText.style.position = "fixed";
    iceText.style.top = "30%";
    iceText.style.left = "50%";
    iceText.style.transform = "translate(-50%, -50%)";
    iceText.style.fontSize = "15px";
    iceText.style.color = "#fff";
    iceText.style.padding = "10px 20px";
    iceText.style.backgroundColor = "rgba(0, 191, 255, 0.8)";
    iceText.style.borderRadius = "8px";
    iceText.style.zIndex = "1000";
    iceText.style.pointerEvents = "none";
    iceText.style.animation = "floatUp 2s ease-out forwards";
    document.body.appendChild(iceText);

    setTimeout(() => {
      if (document.body.contains(iceText)) {
        document.body.removeChild(iceText);
      }
    }, 2000);

    setTimeout(() => {
      document.documentElement.style.setProperty("--background-color", "#ecf0f1");
      if (scoreEl) scoreEl.style.boxShadow = "none";
      if (highScoreEl) highScoreEl.style.boxShadow = "none";
      startTimer();
    }, 5000);
  }, [startTimer]);

  const bombEffect = useCallback(() => {
    document.documentElement.style.setProperty("--background-color", "rgba(255, 0, 0, 0.3)");
    if (bombSoundRef.current) {
      bombSoundRef.current.currentTime = 0;
      bombSoundRef.current.play().catch((err) => console.error(err));
    }

    let bombText = document.createElement("div");
    bombText.textContent = "💣 Ohh, you lost 5 points! 😢";
    bombText.style.position = "fixed";
    bombText.style.top = "30%";
    bombText.style.left = "50%";
    bombText.style.transform = "translate(-50%, -50%)";
    bombText.style.fontSize = "17px";
    bombText.style.color = "#fff";
    bombText.style.padding = "10px 20px";
    bombText.style.backgroundColor = "rgba(255, 0, 0, 0.8)";
    bombText.style.borderRadius = "8px";
    bombText.style.zIndex = "1000";
    bombText.style.pointerEvents = "none";
    bombText.style.animation = "floatUp 2s ease-out forwards";
    document.body.appendChild(bombText);

    if (!canvasRef.current.classList.contains("bomb-shake")) {
      canvasRef.current.classList.add("bomb-shake");
      setTimeout(() => {
        canvasRef.current.classList.remove("bomb-shake");
      }, 2000);
    }

    setTimeout(() => {
      document.documentElement.style.setProperty("--background-color", "#ecf0f1");
      if (document.body.contains(bombText)) {
        document.body.removeChild(bombText);
      }
    }, 1000);
  }, []);

  // ─── EVENT LISTENERS & SOUND PRELOADING ─────────────────────────
  useEffect(() => {
    // Cache DOM elements for better performance
    scoreElementRef.current = document.getElementById("score");
    timerElementRef.current = document.getElementById("timer");
    highScoreElementRef.current = document.getElementById("high_score");
    
    backgroundMusicRef.current = new Audio("/backgroundmusic.mp3");
    backgroundMusicRef.current.loop = true;
    sliceSoundRef.current = new Audio("/slicesound.mp3");
    bombSoundRef.current = new Audio("/slicesoundbomb.mp3");

    backgroundMusicRef.current.muted = isMuted;
    sliceSoundRef.current.muted = isMuted;
    bombSoundRef.current.muted = isMuted;

    const canvas = canvasRef.current;
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      lastPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      slashPointsRef.current = [lastPosRef.current];
    };

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const currentPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      
      // Add more points for smoother slicing
      const lastPos = lastPosRef.current;
      const distance = Math.sqrt(
        Math.pow(currentPos.x - lastPos.x, 2) + Math.pow(currentPos.y - lastPos.y, 2)
      );
      
      // Add intermediate points if the distance is too large
      if (distance > 30) { // Increased threshold
        const steps = Math.min(Math.floor(distance / 15), 3); // Reduced steps and max 3
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const intermediatePos = {
            x: lastPos.x + (currentPos.x - lastPos.x) * t,
            y: lastPos.y + (currentPos.y - lastPos.y) * t
          };
          slashPointsRef.current.push(intermediatePos);
        }
      }
      
      slashPointsRef.current.push(currentPos);
      handleSlice(slashPointsRef.current);
      lastPosRef.current = currentPos;
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      slashPointsRef.current = [];
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);

    const handleTouchStart = (e) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      lastPosRef.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      slashPointsRef.current = [lastPosRef.current];
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      if (!isDraggingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const currentPos = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      
      // Add more points for smoother slicing on touch
      const lastPos = lastPosRef.current;
      const distance = Math.sqrt(
        Math.pow(currentPos.x - lastPos.x, 2) + Math.pow(currentPos.y - lastPos.y, 2)
      );
      
      // Add intermediate points if the distance is too large
      if (distance > 25) { // Increased threshold for touch
        const steps = Math.min(Math.floor(distance / 12), 2); // Reduced steps and max 2
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const intermediatePos = {
            x: lastPos.x + (currentPos.x - lastPos.x) * t,
            y: lastPos.y + (currentPos.y - lastPos.y) * t
          };
          slashPointsRef.current.push(intermediatePos);
        }
      }
      
      slashPointsRef.current.push(currentPos);
      handleSlice(slashPointsRef.current);
      lastPosRef.current = currentPos;
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      isDraggingRef.current = false;
      slashPointsRef.current = [];
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

    document.body.addEventListener(
      "touchstart",
      (e) => {
        if (e.target === canvas) e.preventDefault();
      },
      { passive: false }
    );
    document.body.addEventListener(
      "touchmove",
      (e) => {
        if (e.target === canvas) e.preventDefault();
      },
      { passive: false }
    );
    document.body.addEventListener(
      "touchend",
      (e) => {
        if (e.target === canvas) e.preventDefault();
      },
      { passive: false }
    );

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
    };
  }, [resizeCanvas, handleSlice]);

  useEffect(() => {
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.muted = isMuted;
      if (isMuted) {
        backgroundMusicRef.current.pause();
      } else {
        backgroundMusicRef.current.play().catch((err) => console.error(err));
      }
    }
    if (sliceSoundRef.current) {
      sliceSoundRef.current.muted = isMuted;
    }
    if (bombSoundRef.current) {
      bombSoundRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (startGame) {
      initGame();
    }
  }, [startGame]);

  const initGame = useCallback(async () => {
    await fetchHighScoreWrapper();
    fruitsRef.current = [];
    scoreRef.current = 0;
    timeRemainingRef.current = 45;
    gameOverRef.current = false;
    updateUI(scoreRef.current, timeRemainingRef.current, highScoreRef.current);
    clearInterval(gameLoopRef.current);
    clearInterval(spawnIntervalRef.current);
    clearInterval(timerIntervalRef.current);
    clearInterval(goldenCoinIntervalRef.current);

    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.muted = isMuted;
      backgroundMusicRef.current.currentTime = 0;
      if (!isMuted) {
        backgroundMusicRef.current.play().catch((err) => console.error(err));
      }
    }

    gameLoopRef.current = setInterval(updateGame, 1000 / FRAME_RATE);
    spawnIntervalRef.current = setInterval(spawnFruit, 1200); // Faster spawning for increased difficulty
    goldenCoinIntervalRef.current = setInterval(spawnGoldenCoin, 20000); // More frequent golden coins
    startTimer();
  }, [fetchHighScoreWrapper, updateUI, isMuted, updateGame, spawnFruit, spawnGoldenCoin, startTimer]);

  // Inject pulse animation CSS.
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse {
        0% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.2); }
        100% { transform: translate(-50%, -50%) scale(1); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return <canvas id="gameCanvas" ref={canvasRef} />;
};

export default Game;
