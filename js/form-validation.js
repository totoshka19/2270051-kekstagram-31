import { isEscapeKey } from './util.js';
import { setScale, defaultScale, setEffect, defaultEffect } from './edit-image.js';
import { sendData, submitButtonText } from './fetch-api.js';

const FILE_TYPES = ['.gif', '.jpeg', '.jpg', '.png', '.jfif'];

const hashtagErrorMessages = {
  1: `Хэш-тег должен начинаться с символа #.<br>
    Хэш-тег не может состоять только из одного символа.<br>
    Строка после решётки должна состоять из букв и чисел.<br>
    Максимальная длина хэш-тега 20 символов.`,
  2: 'Хэш-теги не должны повторяться.',
  3: 'Нельзя указать больше пяти хэш-тегов.'
};

const uploadForm = document.querySelector('.img-upload__form'); // форма отправки информации о фотографии на сервер
const uploadInput = uploadForm.querySelector('.img-upload__input'); // поле для загрузки фотографии
const uploadOverlay = uploadForm.querySelector('.img-upload__overlay'); // модальное окно редактирования фотографии
const hashtagInput = uploadForm.querySelector('.text__hashtags');
const commentInput = uploadForm.querySelector('.text__description');
const imgUploadPreview = uploadForm.querySelector('.img-upload__preview img'); // просмотр фото для загрузки
const effectsPreview = uploadForm.querySelectorAll('.effects__preview'); // маленькие превьюшки фото
const btnCloseUploadForm = uploadForm.querySelector('.img-upload__cancel'); // крестик закрытия на большом изображении
const btnUploadSubmit = uploadForm.querySelector('.img-upload__submit'); // кнопка "Опубликовать"

// массив для запоминания всех ошибок в процессе валидации
let hashtagsErrorList = [];

// обработчик нажатия клавиши Esc
const onDocumentKeydown = (evt) => {
  if (isEscapeKey(evt)) {
    // проверяем, находится ли фокус в поле ввода хэштега или комментария
    if (document.activeElement === hashtagInput || document.activeElement === commentInput) {
      return; // если фокус находится в поле ввода хэштега или комментария, то форма не закроется
    }
    evt.preventDefault();
    // eslint-disable-next-line no-use-before-define
    closeUploadForm();
  }
};

const pristine = new Pristine(uploadForm, {
  classTo: 'img-upload__field-wrapper',
  errorClass: 'img-upload__field-wrapper--error',
  errorTextParent: 'img-upload__field-wrapper',
  errorTextTag: 'div',
  errorTextClass: 'img-upload__field-wrapper--error',
});

// функция валидации хештегов, которая передаётся в библиотеку Pristine
const validateHashtag = (value) => {
  const regex = /^#[a-zа-яё0-9]{1,19}$/i;
  hashtagsErrorList = [];
  const hashtags = value.trim().split(' ');

  // удаление строк, состоящих только из пробелов
  const hashtagsFiltered = hashtags.filter((hashtag) => hashtag.trim() !== '');

  // проверка на правильный формат хэштега
  for (const hashtag of hashtagsFiltered) {
    if (!regex.test(hashtag)) {
      hashtagsErrorList.push(1);
    }
  }

  // проверка на повторяющиеся хэштеги
  const uniqueHashtags = new Set(hashtagsFiltered);
  if (hashtagsFiltered.length !== uniqueHashtags.size) {
    hashtagsErrorList.push(2);
  }

  // проверка на максимальное количество хэштегов
  if (hashtagsFiltered.length > 5) {
    hashtagsErrorList.push(3);
  }

  // если в переменной hashtagsErrorList есть данные, это означает, что в процессе валидации были найдены ошибки
  if (hashtagsErrorList.length === 0) {
    const err = pristine.getErrors(commentInput);
    if (err === undefined || err.length === 0) { // проверка, есть ли ошибка в блоке комментариев
      btnUploadSubmit.disabled = false; // делаем кнопку "Опубликовать" доступной, если нигде нет ошибок
    }
    return true;
  } else {
    btnUploadSubmit.disabled = true;
    return false;
  }
};

// функция валидации комментариев, которая передаётся в библиотеку Pristine
const validateComment = (value) => {
  if (value.length > 140) {
    btnUploadSubmit.disabled = true;
    return false;
  } else {
    const err = pristine.getErrors(hashtagInput);
    if (err === undefined || err.length === 0) { // проверка, есть ли ошибка в блоке хэштегов
      btnUploadSubmit.disabled = false; // делаем кнопку "Опубликовать" доступной, если нигде нет ошибок
    }
    return true;
  }
};

// возвращаем текст первой ошибки из массива
const showErrorMessage = () => hashtagErrorMessages[hashtagsErrorList[0]];

pristine.addValidator(
  hashtagInput,
  validateHashtag,
  showErrorMessage
);

pristine.addValidator(
  commentInput,
  validateComment,
  'Комментарий не может содержать более 140 символов.'
);

// функция открывает форму загрузки
const openUploadForm = () => {
  document.querySelector('#effect-none').checked = true; // выбираем radio button с оригинальным эффектом
  setScale(defaultScale); // установка дефолтного масштаба изображения
  setEffect(defaultEffect); // установка дефолтного эффекта изображения
  document.body.classList.add('modal-open');
  uploadOverlay.classList.remove('hidden');
  document.addEventListener('keydown', onDocumentKeydown); // закрывает окно по нажатию клавиши Esc
};

// функция закрывает форму загрузки
const closeUploadForm = () => {
  uploadOverlay.classList.add('hidden');
  uploadInput.value = '';
  hashtagInput.value = '';
  commentInput.value = '';
  imgUploadPreview.src = '';
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', onDocumentKeydown); // удаляем обработчик нажатия клавиши Esc
  pristine.reset(); // очищаем ошибки и состояние валидации
};

// функция для вывода ошибки о недопустимом формате файла
const showFileTypeError = () => {
  const template = document.querySelector('#data-error');
  const errorElement = template.content.cloneNode(true);
  const errorSection = errorElement.querySelector('.data-error');

  // добавляем кастомный текст ошибки
  const errorMessageElement = errorSection.querySelector('.data-error__title');
  if (errorMessageElement) {
    errorMessageElement.textContent = 'Недопустимое расширение файла';
  }

  document.body.appendChild(errorSection);

  // удаляем ошибку через 5 секунд
  setTimeout(() => {
    errorSection.remove();
  }, 5000);
};

// функция подставляет загружаемое фото в форму предварительного просмотра
const getPhotoPreview = (evt) => {
  const file = evt.target.files[0]; // получаем первый файл, выбранный пользователем в input элементе
  const reader = new FileReader();

  reader.addEventListener('load', () => {
    imgUploadPreview.src = reader.result; // отображаем загруженное изображение в окне предварительного просмотра
    setScale(defaultScale);
    setEffect(defaultEffect);

    // устанавливаем фоновое изображение для маленьких превьюшек
    effectsPreview.forEach((preview) => {
      preview.style.backgroundImage = `url(${reader.result})`;
    });
  });

  reader.readAsDataURL(file); // читаем файл как данные URL
};

// обработчик события change для поля ввода файлов
uploadInput.addEventListener('change', (evt) => {
  const file = evt.target.files[0];
  const fileName = file.name.toLowerCase();

  // проверяем расширение файла
  const isValidExtension = FILE_TYPES.some((extension) => fileName.endsWith(extension));

  if (isValidExtension) {
    getPhotoPreview(evt);
    openUploadForm();
  } else {
    showFileTypeError(); // выводим ошибку из шаблона
  }
});

// закрывает форму загрузки по нажатию на крестик
btnCloseUploadForm.addEventListener('click', (evt) => {
  evt.preventDefault();
  closeUploadForm();
});

// обработчик отправки формы
const onUploadFormSubmit = async (evt) => {
  evt.preventDefault();
  btnUploadSubmit.disabled = true;
  btnUploadSubmit.textContent = submitButtonText.SENDING;
  sendData(evt.target).then(() => {
    closeUploadForm();
  }, () => {});
};

// установка обработчика отправки формы
uploadForm.addEventListener('submit', onUploadFormSubmit);

export { btnUploadSubmit };
