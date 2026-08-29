export function createSerializedTask(task) {
  let queue = Promise.resolve();

  return (...args) => {
    const operation = queue.then(() => task(...args));
    queue = operation.catch(() => {});
    return operation;
  };
}
