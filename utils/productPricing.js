const roundMoney = (value) => Math.round(value * 100) / 100;

export const normalizeProductPricing = ({ price, discountPrice, discountPercent }) => {
  const parsedPrice = Number(price);

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    throw new Error("Enter a valid product price");
  }

  if (
    (discountPercent === undefined || discountPercent === null || discountPercent === "") &&
    (discountPrice === undefined || discountPrice === null || discountPrice === "")
  ) {
    return {
      price: parsedPrice,
      discountPrice: null,
      discountPercent: null,
    };
  }

  if (discountPercent !== undefined && discountPercent !== null && discountPercent !== "") {
    const parsedDiscountPercent = Number(discountPercent);

    if (!Number.isFinite(parsedDiscountPercent) || parsedDiscountPercent <= 0 || parsedDiscountPercent >= 100) {
      throw new Error("Discount percent must be greater than 0 and less than 100");
    }

    const computedDiscountPrice = roundMoney(parsedPrice * (1 - parsedDiscountPercent / 100));

    return {
      price: parsedPrice,
      discountPrice: computedDiscountPrice,
      discountPercent: parsedDiscountPercent,
    };
  }

  const parsedDiscountPrice = Number(discountPrice);

  if (!Number.isFinite(parsedDiscountPrice) || parsedDiscountPrice <= 0) {
    throw new Error("Enter a valid discount price");
  }

  if (parsedDiscountPrice >= parsedPrice) {
    throw new Error("Discount price must be lower than the regular price");
  }

  return {
    price: parsedPrice,
    discountPrice: parsedDiscountPrice,
    discountPercent: roundMoney(((parsedPrice - parsedDiscountPrice) / parsedPrice) * 100),
  };
};

export const getProductSellingPrice = (product) => {
  const price = Number(product?.price) || 0;
  const discountPercent = Number(product?.discountPercent);
  const discountPrice = Number(product?.discountPrice);

  if (Number.isFinite(discountPercent) && discountPercent > 0 && discountPercent < 100 && price > 0) {
    return roundMoney(price * (1 - discountPercent / 100));
  }

  if (Number.isFinite(discountPrice) && discountPrice > 0 && discountPrice < price) {
    return discountPrice;
  }

  return price;
};