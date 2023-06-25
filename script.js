'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

function generateRandomUUID() {
  var uuid = '';
  for (var i = 0; i < 10; i++) {
    uuid += Math.floor(Math.random() * 10);
  }
  return uuid;
}

class Workout {
  date = new Date();
  id = generateRandomUUID();
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // km
    this.duration = duration; //minutes
  }

  _setDescription() {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace; // min/km
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60); //km/h

    return this.speed;
  }
}

// APP Architecture
class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  constructor() {
    this._getPositon(); //get position

    this._getLocalStorage(); //get data from local storage

    // attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));

    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));

  }

  _getPositon() {
    // GEOLOCATION API
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert("Couldn't get your location");
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;

    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // handle clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // empty inputs
    inputDistance.value =
      inputCadence.value =
      inputDuration.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => {
      form.style.display = 'grid';
    }, 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    e.preventDefault();

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // Check if editing an existing workout or creating a new one
    const editBtn = e.target.querySelector('.edit-submit');
    if (editBtn) {
      const workoutId = editBtn.dataset.id;
      workout = this.#workouts.find(work => work.id === workoutId);

      workout.distance = distance;
      workout.duration = duration;

      if (type === 'running') {
        // validate data

        const cadence = +inputCadence.value;
        if (
          !validInputs(distance, duration, cadence) ||
          !allPositive(distance, duration, cadence)
        )
          return alert('Inputs have to be positive numbers!');
        workout.cadence = cadence;
      } else if (type === 'cycling') {
        const elevation = +inputElevation.value;
        if (
          !validInputs(distance, duration, elevation) ||
          !allPositive(distance, duration)
        )
          return alert('Inputs have to be positive numbers!');
        workout.elevationGain = elevation;
      }

      // Update the workout marker popup content
      workoutMarker = workout.marker;
      workoutMarker.setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      );
    } else {
      // Create a new workout object
      if (type === 'running') {
        const cadence = +inputCadence.value;
        workout = new Running([lat, lng], distance, duration, cadence);
      } else if (type === 'cycling') {
        const elevation = +inputElevation.value;
        workout = new Cycling([lat, lng], distance, duration, elevation);
      }

      // Add the new workout object to the workouts array
      this.#workouts.push(workout);

      // Render the workout on the map as a marker
      this._renderWorkoutMarker(workout);

      // Render the workout on the workout list
      this._renderWorkout(workout);
    }

    // Clear the input fields
    this._hideForm();

    // Update local storage
    this._setLocalStorage();
  }

  // Display marker
  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
       <span class="workout__title">
       <div>
       <h2 >${workout.description}</h2>
       </div>
       <div class='btn'>
       <button class='edit' data-id="${workout.id}">Edit</button>
        <button class='del' data-id="${workout.id}">Delete</button>
       </div>
       </span>
      
      
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        `;

    if (workout.type === 'running')
      html += ` 
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
  </li>`;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
  </li>
`;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using public interface
    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  _editWorkout(e) {
    const editBtn = e.target.closest('.edit');
    if (!editBtn) return;

    const workoutId = editBtn.dataset.id;
    const workout = this.#workouts.find(work => work.id === workoutId);

    // Clear the existing form
    this._hideForm();

    // Fill the form with workout data
    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    if (workout.type === 'running') {
      inputCadence.value = workout.cadence;
      inputElevation.value = ''; // Clear the elevation field
    } else if (workout.type === 'cycling') {
      inputCadence.value = ''; // Clear the cadence field
      inputElevation.value = workout.elevationGain;
    }

    // Show the form with pre-filled data
    form.classList.remove('hidden');
  }

  _deleteWorkout(e) {
    const deleteBtn = e.target.closest('.del');
    if (!deleteBtn) return;

    const workoutId = deleteBtn.dataset.id;
    const workoutIndex = this.#workouts.findIndex(
      work => work.id === workoutId
    );

    // Remove the workout from the workouts array
    this.#workouts.splice(workoutIndex, 1);

    // Remove the workout from the UI
    const workoutElement = deleteBtn.closest('.workout');
    workoutElement.remove();

    // Remove the workout marker from the map
    if (this.#map) {
      this.#map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.options.id === workoutId) {
          this.#map.removeLayer(layer);
        }
      });
    }

    // Update local storage
    this._setLocalStorage();
  }
}

const app = new App();
