const inputRange = document.getElementById("inputRange");
const activeColor = "#377494";
const inactiveColor = "#dddddd";

inputRange.addEventListener("input", function() {
  const ratio = (this.value - this.min) / (this.max - this.min) * 100;
  this.style.background = `linear-gradient(90deg, ${activeColor} ${ratio}%, ${inactiveColor} ${ratio}%)`;
});
