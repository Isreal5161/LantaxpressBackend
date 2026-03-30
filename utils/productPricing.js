export const normalizeProductPricing = ({ price, discountPrice }) => {
  const parsedPrice = Number(price);

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    throw new Error("Enter a valid product price");
  }

  if (discountPrice === undefined || discountPrice === null || discountPrice === "") {
    return {
      price: parsedPrice,
      discountPrice: null,
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
  };
};

export const getProductSellingPrice = (product) => {
  const price = Number(product?.price) || 0;
  const discountPrice = Number(product?.discountPrice);

  if (Number.isFinite(discountPrice) && discountPrice > 0 && discountPrice < price) {
    return discountPrice;
  }

  return price;
};