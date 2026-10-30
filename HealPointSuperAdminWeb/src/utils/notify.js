import toast from "react-hot-toast";

const activeToasts = new Map();
const DEDUPE_WINDOW = 2400;

const getKey = (type, message, options = {}) =>
  options.id || `${type}:${typeof message === "string" ? message : JSON.stringify(message)}`;

const show = (type, message, options = {}) => {
  const key = getKey(type, message, options);
  const now = Date.now();
  const previous = activeToasts.get(key);

  if (previous && now - previous < DEDUPE_WINDOW) {
    return key;
  }

  activeToasts.set(key, now);
  window.setTimeout(() => activeToasts.delete(key), DEDUPE_WINDOW);
  return type === "blank"
    ? toast(message, { ...options, id: key })
    : toast[type](message, { ...options, id: key });
};

const notify = Object.assign(
  (message, options = {}) => show("blank", message, options),
  {
    success: (message, options = {}) => show("success", message, options),
    error: (message, options = {}) => show("error", message, options),
    loading: (message, options = {}) => show("loading", message, options),
    dismiss: toast.dismiss,
    remove: toast.remove,
    promise: toast.promise,
    custom: toast.custom,
  }
);

export { notify as toast };
export default notify;
